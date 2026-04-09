// listening-script.js

(function () {
  const PACK_ORDER = ["ai-listening-full"];
  const PACK_META = {
    "ai-listening-full": { emoji: "🎧", label: "ll.bin.ooo" }
  };

  const LAST_PACK_KEY = "listening_last_pack";
  const params = new URLSearchParams(location.search);
  const urlPack = params.get("pack");

  let currentPack = urlPack || localStorage.getItem(LAST_PACK_KEY) || PACK_ORDER[0];
  if (!PACK_ORDER.includes(currentPack)) currentPack = PACK_ORDER[0];

  function boot(packKey) {
    window.PACK = undefined;

    const oldDynamic = document.getElementById("__pack_loader__");
    if (oldDynamic) oldDynamic.remove();

    const script = document.createElement("script");
    script.id = "__pack_loader__";
    script.src = "packs/" + packKey + ".js";

    script.onload = async function () {
      if (!window.PACK || typeof window.PACK !== "object") {
        renderBootError("PACK 資料格式錯誤，請檢查 packs/" + packKey + ".js");
        return;
      }

      if (window.PACK.scriptFile) {
        try {
          const resp = await fetch(window.PACK.scriptFile, { cache: "no-cache" });
          if (!resp.ok) throw new Error("HTTP " + resp.status);

          const raw = await resp.text();
          const parsedQuestions = parseFullScriptPairs(raw);
          if (!parsedQuestions.length) {
            throw new Error("格式不符：請使用 ===SEGMENT=== / JP: / ZH:");
          }

          window.PACK.questions = parsedQuestions;
        } catch (e) {
          renderBootError("fullscript 讀取失敗: " + String(e && e.message ? e.message : e));
          return;
        }
      }

      localStorage.setItem(LAST_PACK_KEY, packKey);
      initListeningApp(window.PACK, packKey, PACK_ORDER, PACK_META);
    };

    script.onerror = function () {
      renderBootError("載入失敗：packs/" + packKey + ".js");
    };

    document.head.appendChild(script);
  }

  function renderBootError(msg) {
    const article = document.querySelector("#article");
    const title = document.querySelector("#page-title");
    const desc = document.querySelector("#page-desc");

    if (title) title.textContent = "Listening Pack Error";
    if (desc) desc.textContent = msg;

    if (article) {
      article.innerHTML = "";
      const p = document.createElement("p");
      p.className = "line-ja";
      p.textContent = "ファイル読込に失敗しました。";
      article.appendChild(p);
    }
  }

  // fullscript.txt 形式：
  // 日文
  // 中文
  //
  // 日文
  // 中文
  //
  // ...
  function parseFullScriptPairs(raw) {
    const text = String(raw || "").replace(/\r\n/g, "\n").trim();
    if (!text) return [];

    const blocks = text.split("===SEGMENT===")
      .map(function (s) { return s.trim(); })
      .filter(Boolean);

    const questions = [];
    let id = 1;

    blocks.forEach(function (block) {
      const lines = block.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      const jpLines = [];
      const zhLines = [];

      lines.forEach(function (line) {
        if (line.startsWith("JP:")) {
          jpLines.push(line.slice(3).trim());
        } else if (line.startsWith("ZH:")) {
          zhLines.push(line.slice(3).trim());
        }
      });

      questions.push({
        id: id++,
        title: "",
        variants: [
          {
            text: jpLines.join("\n"),
            translation: zhLines.join("\n")
          }
        ]
      });
    });

    return questions;
  }

  boot(currentPack);
})();

function initListeningApp(PACK, currentPack, PACK_ORDER, PACK_META) {
  const DRAWER_OPEN_KEY = "listening_drawer_open";
  const HIDE_TRANSLATION_KEY = "listening_hide_translation";
  const $ = function (sel) { return document.querySelector(sel); };

  const pageTitle = $("#page-title");
  const pageDesc = $("#page-desc");
  const heroImage = $("#hero-image");
  const heroAudioToggle = $("#hero-audio-toggle");
  const article = $("#article");
  const toggleTranslation = $("#toggle-translation");

  const packSwitch = $("#pack-switch");
  const drawerToggle = $("#pack-drawer-toggle");
  const mobileDrawer = $("#pack-mobile-drawer");
  const mobileDrawerList = $("#pack-mobile-drawer-list");

  const meta = PACK_META[currentPack] || {
    emoji: "📄",
    label: PACK.displayName || PACK.name || "Pack"
  };

  let hideTranslation = false;
  const heroAudioPlayer = new Audio();
  heroAudioPlayer.preload = "none";

  function saveDrawerOpenState(isOpen) {
    try {
      sessionStorage.setItem(DRAWER_OPEN_KEY, isOpen ? "1" : "0");
    } catch (_) {}
  }

  function getDrawerOpenState() {
    try {
      return sessionStorage.getItem(DRAWER_OPEN_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s == null ? "" : String(s);
    return div.innerHTML;
  }

  function normalizeVariant(v) {
    if (typeof v === "string") {
      return { text: v, translation: "" };
    }
    if (v && typeof v === "object") {
      return {
        text: v.text || "",
        translation: v.translation || v.zh || "",
        audio: v.audio || null,
        image: v.image || null
      };
    }
    return { text: "", translation: "" };
  }

  function firstVariantOf(question) {
    if (!question || !Array.isArray(question.variants) || question.variants.length === 0) {
      return { text: "", translation: "" };
    }
    return normalizeVariant(question.variants[0]);
  }

  function isMobileViewport() {
    return typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 1023px)").matches;
  }

  function closeDrawer() {
    if (!mobileDrawer) return;
    mobileDrawer.classList.remove("is-open");
    if (drawerToggle) drawerToggle.setAttribute("aria-expanded", "false");
    saveDrawerOpenState(false);
  }

  function openDrawer() {
    if (!mobileDrawer) return;
    mobileDrawer.classList.add("is-open");
    if (drawerToggle) drawerToggle.setAttribute("aria-expanded", "true");
    saveDrawerOpenState(true);
  }

  function toggleDrawer() {
    if (!mobileDrawer) return;
    if (mobileDrawer.classList.contains("is-open")) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }

  function goToPack(packKey) {
    const url = new URL(window.location.href);
    url.searchParams.set("pack", packKey);
    window.location.href = url.toString();
  }

  function setTranslationHidden(hidden) {
    hideTranslation = hidden;
    try {
      localStorage.setItem(HIDE_TRANSLATION_KEY, hidden ? "1" : "0");
    } catch (_) {}

    document.body.classList.toggle("hide-translation", hidden);

    if (toggleTranslation) {
      toggleTranslation.textContent = hidden ? "表" : "隱";
      toggleTranslation.setAttribute("aria-pressed", hidden ? "true" : "false");
    }
  }

  function renderHeader() {
    if (packSwitch) packSwitch.textContent = meta.label || "ll.bin.ooo";
    if (pageTitle) pageTitle.textContent = PACK.title || PACK.displayName || PACK.name || "";
    if (pageDesc) pageDesc.textContent = PACK.description || "";
  }

  function renderHero() {
    const topAudio = PACK.audio || null;
    const topImage = PACK.image || null;

    if (heroAudioToggle) {
      if (topAudio) {
        heroAudioPlayer.src = topAudio;
        heroAudioPlayer.loop = true;
        heroAudioToggle.style.display = "";
        heroAudioToggle.textContent = "🎧";
        heroAudioToggle.setAttribute("aria-pressed", "false");
      } else {
        heroAudioPlayer.pause();
        heroAudioPlayer.removeAttribute("src");
        heroAudioPlayer.loop = false;
        heroAudioPlayer.load();
        heroAudioToggle.style.display = "none";
      }
    }

    if (heroImage) {
      if (topImage) {
        heroImage.src = topImage;
        heroImage.alt = PACK.title || PACK.displayName || PACK.name || "cover";
        heroImage.style.display = "";
      } else {
        heroImage.removeAttribute("src");
        heroImage.style.display = "none";
      }
    }
  }

  function renderArticle() {
    if (!article) return;
    article.innerHTML = "";

    const questions = Array.isArray(PACK.questions) ? PACK.questions : [];

    questions.forEach(function (q, index) {
      const v = firstVariantOf(q);
      const sectionTranslation = v.translation || q.translation || "";

      const sec = document.createElement("section");
      sec.className = "article-block";
      sec.dataset.index = String(index);

      if (q.title) {
        const title = document.createElement("h3");
        title.className = "article-subtitle";
        title.textContent = q.title;
        sec.appendChild(title);
      }

      const ja = document.createElement("div");
      ja.className = "line-ja";
      ja.innerHTML = escapeHtml(v.text).replace(/\n/g, "<br>");

      sec.appendChild(ja);

      if (sectionTranslation) {
        const zh = document.createElement("div");
        zh.className = "line-zh";
        zh.innerHTML = escapeHtml(sectionTranslation).replace(/\n/g, "<br>");
        sec.appendChild(zh);
      }

      article.appendChild(sec);
    });

    if (questions.length === 0) {
      const empty = document.createElement("p");
      empty.className = "line-ja";
      empty.textContent = "この pack には表示する本文がまだありません。";
      article.appendChild(empty);
    }
  }

  function renderPackDrawer() {
    if (!mobileDrawerList) return;
    mobileDrawerList.innerHTML = "";

    PACK_ORDER.forEach(function (key) {
      const itemMeta = PACK_META[key] || { emoji: "📄", label: key };

      const row = document.createElement("div");
      row.className = "pack-item" + (key === currentPack ? " active" : "");
      row.dataset.pack = key;

      const prefix = document.createElement("span");
      prefix.className = "pack-item-prefix";
      prefix.textContent = itemMeta.emoji || "📄";

      const name = document.createElement("span");
      name.className = "pack-item-name";
      name.textContent = itemMeta.label || key;

      row.appendChild(prefix);
      row.appendChild(name);

      row.addEventListener("click", function () {
        if (isMobileViewport()) saveDrawerOpenState(true);
        goToPack(key);
      });

      mobileDrawerList.appendChild(row);
    });
  }

  function bindEvents() {
    if (toggleTranslation) {
      toggleTranslation.addEventListener("click", function () {
        setTranslationHidden(!hideTranslation);
      });
    }

    if (packSwitch) packSwitch.setAttribute("aria-hidden", "true");

    if (heroAudioToggle) {
      heroAudioToggle.addEventListener("click", function () {
        if (!heroAudioPlayer.src) return;
        if (heroAudioPlayer.paused) {
          heroAudioPlayer.play().catch(function () {});
        } else {
          heroAudioPlayer.pause();
          heroAudioPlayer.currentTime = 0;
        }
      });
    }

    if (drawerToggle) {
      drawerToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleDrawer();
      });
    }

    document.body.addEventListener("click", function (e) {
      if (!mobileDrawer || !mobileDrawer.classList.contains("is-open")) return;
      if (mobileDrawer.contains(e.target) || (drawerToggle && drawerToggle.contains(e.target))) return;
      closeDrawer();
    });

    window.addEventListener("resize", function () {
      if (!isMobileViewport()) closeDrawer();
    });
  }

  renderHeader();
  renderHero();
  renderArticle();
  renderPackDrawer();
  bindEvents();

  try {
    hideTranslation = localStorage.getItem(HIDE_TRANSLATION_KEY) === "1";
  } catch (_) {
    hideTranslation = false;
  }
  setTranslationHidden(hideTranslation);

  heroAudioPlayer.addEventListener("play", function () {
    if (!heroAudioToggle) return;
    heroAudioToggle.textContent = "■";
    heroAudioToggle.setAttribute("aria-pressed", "true");
  });

  heroAudioPlayer.addEventListener("pause", function () {
    if (!heroAudioToggle) return;
    heroAudioToggle.textContent = "🎧";
    heroAudioToggle.setAttribute("aria-pressed", "false");
  });

  heroAudioPlayer.addEventListener("ended", function () {
    if (!heroAudioPlayer.loop) {
      if (!heroAudioToggle) return;
      heroAudioToggle.textContent = "🎧";
      heroAudioToggle.setAttribute("aria-pressed", "false");
      heroAudioPlayer.currentTime = 0;
    }
  });

  if (isMobileViewport() && getDrawerOpenState()) {
    openDrawer();
  }
}
