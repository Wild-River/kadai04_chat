import { savePin, loadPins, deletePin, updatePin } from "./db.js";
import { uploadPhoto, deletePhoto } from "./storage.js";
import { CATEGORIES } from "./categories.js";

// ============================================
// 状態（地図・マーカー・カテゴリ）
// ============================================

// カテゴリ別にマーカーを保持
const markersByCategory = {};
// アクティブなカテゴリ（初期は全部ON）
const activeCategories = new Set(Object.keys(CATEGORIES));

let currentMap = null;
let currentMapId = import.meta.env.VITE_GOOGLE_MAP_ID; // 初期はモノクロ
// 編集中のブロックを保持
let editingBlocks = [];

// ============================================
// Google Maps SDK 読み込み
// ============================================
let googleMapsPromise = null;   // 読み込みPromiseを覚えておく

export function loadGoogleMaps() {
  // すでに読み込み済みならスキップ
  if (window.google && window.google.maps) {
    return Promise.resolve();
  }
  // すでに読み込み中なら、同じPromiseを返す（二重読み込み防止）
  if (googleMapsPromise) {
    return googleMapsPromise;
  }
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  return new Promise((resolve) => {
    window.initMapCallback = resolve;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&libraries=marker&callback=initMapCallback`;
    document.head.appendChild(script);
  });
}

// ============================================
// 地図の初期化・セットアップ
// ============================================

export function initMap(user) {
  setupMap(user);

  // 初期ラベル
  document.getElementById("style-toggle").textContent = "カラーに切替";

  // スタイル切り替えボタン
  document.getElementById("style-toggle").onclick = () => {
    currentMapId = currentMapId === import.meta.env.VITE_GOOGLE_MAP_ID
      ? import.meta.env.VITE_GOOGLE_MAP_ID_NORMAL
      : import.meta.env.VITE_GOOGLE_MAP_ID;

    const isMonochrome = currentMapId === import.meta.env.VITE_GOOGLE_MAP_ID;
    document.getElementById("style-toggle").textContent = isMonochrome ? "カラーに切替" : "モノクロに切替";

    setupMap(user);   // 地図を作り直す（クリックリスナーも含めて再セット）
  };

  return currentMap;
}

// 地図を初期化して各種セットアップ（初期化・スタイル切替で共通）
function setupMap(user) {
  currentMap = createMap(currentMapId);
  buildFilterBar(currentMap);
  loadAndRenderPins(currentMap);
  attachMapClickListener(currentMap, user);
}

function createMap(mapId) {
  return new google.maps.Map(document.getElementById("map"), {
    center: { lat: 35.6700, lng: 139.7023 },
    zoom: 15,
    mapId: mapId,
    mapTypeControl: false,     // 地図/航空写真
    streetViewControl: false,  // ストリートビューの人形アイコン
    fullscreenControl: false,  // 全画面ボタン
  });
}

// 地図にクリックリスナーを設定（新規作成を開く）
function attachMapClickListener(map, user) {
  map.addListener("click", (event) => {
    openEditMode(map, {
      mode: "new",
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
      user,
    });
  });
}

function loadAndRenderPins(map) {
  // マーカー保持をリセット（地図を作り直すため）
  for (const key in markersByCategory) {
    delete markersByCategory[key];
  }

  loadPins().then(pins => {
    pins.forEach(pin => {
      addMarker(map, pin);
    });
  });
}

// ============================================
// カテゴリフィルター
// ============================================

function buildFilterBar(map) {
  const bar = document.getElementById("filter-bar");
  bar.innerHTML = "";

  Object.entries(CATEGORIES).forEach(([key, cat]) => {
    const chip = document.createElement("button");
    chip.className = "filter-chip active";
    chip.style.background = cat.color;
    chip.innerHTML = cat.label;

    chip.onclick = () => {
      if (activeCategories.has(key)) {
        activeCategories.delete(key);
        chip.classList.remove("active");
        chip.style.background = "#f0f0f0";
      } else {
        activeCategories.add(key);
        chip.classList.add("active");
        chip.style.background = cat.color;
      }
      applyFilter();
    };

    bar.appendChild(chip);
  });
}

function applyFilter() {
  Object.entries(markersByCategory).forEach(([category, markers]) => {
    const visible = activeCategories.has(category);
    markers.forEach(marker => {
      marker.map = visible ? marker._map : null;
    });
  });
}

// ============================================
// ピン・マーカー
// ============================================

function createPin(category) {
  const cat = CATEGORIES[category] || { color: "#666", icon: "" };

  // SVGを文字列で作る
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 -1050 960 960" fill="white"><path d="${cat.icon}"></path></svg>`;
  // データURIに変換
  const glyphSrc = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  const pin = new google.maps.marker.PinElement({
    background: cat.color,
    borderColor: "white",
    glyphSrc: glyphSrc,
    scale: 1.2,
  });

  return pin;
}

function addMarker(map, pin) {
  const pinElement = createPin(pin.category);

  const marker = new google.maps.marker.AdvancedMarkerElement({
    position: { lat: pin.lat, lng: pin.lng },
    map: map,
    content: pinElement.element,
  });
  // 白い縁取り（filter）をマーカーのcontentに当てる
  pinElement.element.style.filter = "drop-shadow(0 0 1px white) drop-shadow(0 0 1px white)";

  marker._map = map; // 後で復元用に保持

  // カテゴリ別に保存
  if (!markersByCategory[pin.category]) {
    markersByCategory[pin.category] = [];
  }
  markersByCategory[pin.category].push(marker);

  marker.addListener("gmp-click", () => {
    openDetailPanel(map, pin, marker);
  });

  return marker;
}

// ============================================
// 詳細パネル（表示モード）
// ============================================

function openDetailPanel(map, pin, marker) {
  const panel = document.getElementById("detail-panel");
  const cat = CATEGORIES[pin.category] || { label: "その他", color: "#666" };

  // 表示モードを見せる、編集フォームは隠す
  document.getElementById("detail-view").style.display = "";
  document.getElementById("detail-edit-form").style.display = "none";

  document.getElementById("detail-name").textContent = pin.name;

  const categoryEl = document.getElementById("detail-category");
  categoryEl.textContent = cat.label;
  categoryEl.style.background = cat.color;

  // ブロックを描画
  const blocksContainer = document.getElementById("detail-blocks");
  blocksContainer.innerHTML = "";
  (pin.blocks || []).forEach(block => {
    if (block.type === "text") {
      const p = document.createElement("p");
      p.className = "detail-text-block";
      p.textContent = block.content;
      blocksContainer.appendChild(p);
    } else if (block.type === "image") {
      const img = document.createElement("img");
      img.className = "detail-image-block";
      img.src = block.url;
      blocksContainer.appendChild(img);
    }
  });

  // 営業時間（任意）
  const hoursRow = document.getElementById("detail-hours-row");
  if (pin.hours) {
    document.getElementById("detail-hours").textContent = pin.hours;
    hoursRow.style.display = "";
  } else {
    hoursRow.style.display = "none";
  }

  // パネルを開く
  panel.classList.add("open");

  // 閉じる
  document.getElementById("detail-close").onclick = () => {
    panel.classList.remove("open");
  };

  // 編集ボタン → 編集モードに切り替え
  document.getElementById("detail-edit").onclick = () => {
    openEditMode(map, { mode: "edit", pin, marker });
  };

  // 削除
  document.getElementById("detail-delete").onclick = async () => {
    if (!confirm("このピンを削除しますか？")) return;
    await deletePin(pin.id);

    // 画像ブロックをすべてStorageから削除
    for (const block of (pin.blocks || [])) {
      if (block.type === "image" && block.url) {
        await deletePhoto(block.url);
      }
    }

    marker.map = null;
    panel.classList.remove("open");
  };
}

// ============================================
// ブロックエディタ（編集・新規モード）
// ============================================

function renderBlocks() {
  const container = document.getElementById("blocks-container");
  container.innerHTML = "";

  editingBlocks.forEach((block, index) => {
    const blockEl = document.createElement("div");
    blockEl.className = "block-item";
    // 操作ボタン（↑↓削除）
    const controls = `
            <div class="block-controls">
                <button type="button" class="block-up" data-index="${index}" ${index === 0 ? "disabled" : ""}>↑</button>
                <button type="button" class="block-down" data-index="${index}" ${index === editingBlocks.length - 1 ? "disabled" : ""}>↓</button>
                <button type="button" class="block-delete" data-index="${index}">削除</button>
            </div>
        `;

    if (block.type === "text") {
      blockEl.innerHTML = `
               <div class="block-header">
                    ${controls}
                </div>
                <textarea class="block-text" rows="3" data-index="${index}">${block.content || ""}</textarea>
            `;
    } else if (block.type === "image") {
      const src = block.url || (block.file ? URL.createObjectURL(block.file) : "");
      blockEl.innerHTML = `
                <div class="block-header">
                    ${controls}
                </div>
                ${src ? `<img class="block-image-preview" src="${src}">` : `<div class="block-image-empty">画像未選択</div>`}
            `;
    }

    container.appendChild(blockEl);
  });
  // ボタンにイベントを設定
  attachBlockControls();
}

function setupBlockAddButtons() {
  // テキストブロックを追加
  document.getElementById("add-text-block").onclick = () => {
    editingBlocks.push({ type: "text", content: "" });
    renderBlocks();
  };

  // 画像ブロックを追加（ファイル選択を促す）
  document.getElementById("add-image-block").onclick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      editingBlocks.push({ type: "image", url: null, file: file });
      renderBlocks();
    };
    input.click();
  };
}

function attachBlockControls() {
  // ↑ 上に移動
  document.querySelectorAll(".block-up").forEach(btn => {
    btn.onclick = () => {
      const i = Number(btn.dataset.index);
      [editingBlocks[i - 1], editingBlocks[i]] = [editingBlocks[i], editingBlocks[i - 1]];
      renderBlocks();
    };
  });

  // ↓ 下に移動
  document.querySelectorAll(".block-down").forEach(btn => {
    btn.onclick = () => {
      const i = Number(btn.dataset.index);
      [editingBlocks[i + 1], editingBlocks[i]] = [editingBlocks[i], editingBlocks[i + 1]];
      renderBlocks();
    };
  });

  // 削除
  document.querySelectorAll(".block-delete").forEach(btn => {
    btn.onclick = () => {
      const i = Number(btn.dataset.index);
      editingBlocks.splice(i, 1);
      renderBlocks();
    };
  });

  // テキスト編集（入力を配列に反映）
  document.querySelectorAll(".block-text").forEach(textarea => {
    textarea.oninput = () => {
      const i = Number(textarea.dataset.index);
      editingBlocks[i].content = textarea.value;
    };
  });
}

async function saveBlockPin({ mode, lat, lng, user, pin, marker }) {
  const isEdit = mode === "edit";
  // 編集時はuserが無いので、アップロード用にuidを用意
  const uid = user?.uid || pin?.userId;

  const category = document.getElementById("edit-category").value;
  const name = document.getElementById("edit-name").value.trim();
  const hours = document.getElementById("edit-hours").value.trim();

  // バリデーション
  if (!category || !name) {
    showEditError("ジャンルと名前は必須です");
    return;
  }
  if (editingBlocks.length === 0) {
    showEditError("本文を1つ以上追加してください");
    return;
  }
  // テキストが空、または画像が未選択のブロックがないかチェック
  for (const block of editingBlocks) {
    if (block.type === "text" && !block.content.trim()) {
      showEditError("空のテキストブロックがあります");
      return;
    }
    if (block.type === "image" && !block.url && !block.file) {
      showEditError("画像が未選択のブロックがあります");
      return;
    }
  }

  clearEditError();

  // 画像ブロックのうち file があるものをアップロード
  const blocks = [];
  for (const block of editingBlocks) {
    if (block.type === "image" && block.file) {
      const url = await uploadPhoto(block.file, uid);
      blocks.push({ type: "image", url });
    } else if (block.type === "image") {
      blocks.push({ type: "image", url: block.url });
    } else {
      blocks.push({ type: "text", content: block.content.trim() });
    }
  }

  const data = {
    lat: lat ?? pin?.lat,
    lng: lng ?? pin?.lng,
    userId: uid,
    category, name, hours, blocks
  };

  if (isEdit) {
    await updatePin(pin.id, { category, name, hours, blocks });
    marker.map = null;
    addMarker(currentMap, { ...data, id: pin.id });
    console.log("更新しました:", data);
  } else {
    const docRef = await savePin(data);
    addMarker(currentMap, { ...data, id: docRef.id });
    console.log("保存しました:", data);
  }

  document.getElementById("detail-panel").classList.remove("open"); // パネルを閉じる
}

function showEditError(message) {
  document.getElementById("edit-form-error").textContent = message;
}

function clearEditError() {
  document.getElementById("edit-form-error").textContent = "";
}

function openEditMode(map, options) {
  const { mode, lat, lng, user, pin, marker } = options;
  const isEdit = mode === "edit";

  const panel = document.getElementById("detail-panel");

  // 編集フォームを見せる、表示モードは隠す
  document.getElementById("detail-view").style.display = "none";
  document.getElementById("detail-edit-form").style.display = "";

  // タイトル
  document.getElementById("edit-title").textContent =
    isEdit ? "スポットを編集" : "新しいスポットを追加";

  // フォーム初期化
  document.getElementById("edit-category").value = isEdit ? pin.category : "";
  document.getElementById("edit-name").value = isEdit ? pin.name : "";
  document.getElementById("edit-hours").value = isEdit ? (pin.hours || "") : "";

  // ブロック初期化（編集時は既存blocksを複製、新規時は空のテキスト1つ）
  if (isEdit) {
    editingBlocks = (pin.blocks || []).map(b => ({ ...b }));
  } else {
    editingBlocks = [{ type: "text", content: "" }];
  }

  renderBlocks();
  setupBlockAddButtons();
  clearEditError();

  // パネルを開く（新規時はまだ開いていないので）
  panel.classList.add("open");

  // 閉じる
  document.getElementById("detail-close").onclick = () => {
    panel.classList.remove("open");
  };

  // 保存
  document.getElementById("edit-submit").onclick = () => {
    saveBlockPin({ mode, lat, lng, user, pin, marker });
  };

  // キャンセル
  document.getElementById("edit-cancel").onclick = () => {
    if (isEdit) {
      // 編集キャンセル → 表示モードに戻す
      openDetailPanel(map, pin, marker);
    } else {
      // 新規キャンセル → パネルを閉じる
      panel.classList.remove("open");
    }
  };
}