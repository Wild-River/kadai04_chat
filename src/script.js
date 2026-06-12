import "./style.css";

import { loginWithGoogle, logout, watchAuthState, handleRedirectResult } from "./firebase.js";
import { loadGoogleMaps, initMap } from "./map.js";

// リダイレクトから戻ってきた結果を処理（エラー確認用）
handleRedirectResult().catch((err) => {
  console.error("リダイレクトログイン失敗:", err);
});

// ログインボタン（飛ばすだけ）
document.getElementById("login-btn").addEventListener("click", () => {
  loginWithGoogle();
});

// ログイン状態によって地図を制御
watchAuthState(async (user) => {
  const info = document.getElementById("user-info");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const styleToggle = document.getElementById("style-toggle");

  if (user) {
    info.textContent = `ログイン中: ${user.displayName}`;
    loginBtn.style.display = "none";    // ログイン中はログインボタンを隠す
    logoutBtn.style.display = "";       // ログアウトボタンを表示
    styleToggle.style.display = "";      // ログイン中は表示
    // ログイン済みなら地図を初期化
    await loadGoogleMaps();
    initMap(user);
  } else {
    info.textContent = "未ログイン";
    loginBtn.style.display = "";        // 未ログインはログインボタンを表示
    logoutBtn.style.display = "none";   // ログアウトボタンを隠す
    styleToggle.style.display = "none";  // 未ログインは隠す
    document.getElementById("map").innerHTML = "ログインすると地図が表示されます";
    document.getElementById("filter-bar").innerHTML = "";
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await logout();
});
