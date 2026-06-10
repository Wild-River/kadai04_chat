import "./style.css";

import { loginWithGoogle, logout, watchAuthState } from "./firebase.js";
import { loadGoogleMaps, initMap } from "./map.js";

document.getElementById("login-btn").addEventListener("click", async () => {
  loginWithGoogle(); // リダイレクトするだけ
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await logout();
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
  }
});
