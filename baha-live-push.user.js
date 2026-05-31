// ==UserScript==
// @name        巴哈推文實況
// @description	自動更新巴哈姆特哈拉板推文
// @namespace   https://github.com/eight04
// @match       https://forum.gamer.com.tw/Co.php*
// @match       https://forum.gamer.com.tw/C.php*
// @version     0.1.0
// @author      eight04 <eight04@gmail.com> (https://github.com/eight04)
// @homepage	https://github.com/eight04/baha-live-push
// @supportURL	https://github.com/eight04/baha-live-push/issues
// @license		MIT
// @compatible firefox Tampermonkey, Violentmonkey, Greasemonkey 4.11+
// @compatible chrome Tampermonkey, Violentmonkey
// @grant none
// @require https://cdnjs.cloudflare.com/ajax/libs/sentinel-js/0.0.7/sentinel.min.js
// ==/UserScript==

/* global sentinel */

sentinel.on("[id^=Commendlist]:not(.live)", el => {
  const span = document.createElement("span");
  span.innerHTML = `
<span class="status"></span>
<button class="live-toggle">開始實況</button>
<style>
  .live {
    display: flex;
    align-items: center;
    padding: 0 36px;
    
    .status {
      flex: 1;
      min-width: 0;
    }
  }
</style>
  `
  const status = span.querySelector(".status");
  const liveToggle = span.querySelector(".live-toggle");
  el.after(span);
  span.classList.toggle("live", true);
  const snb = el.id.match(/\d+/)[0];
  const bsn = location.search.match(/bsn=(\d+)/i)[1];

  let running = false;
  let abortController = null;

  liveToggle.addEventListener("click", async () => {
    if (!running) {
      running = true;
      liveToggle.textContent = "停止實況";
      status.textContent = "正在更新...";
      abortController = new AbortController();
      try {
        await update(abortController.signal);
      } catch (e) {
        status.textContent = e.message;
      } finally {
        running = false;
        liveToggle.textContent = "開始實況";
      }
    } else {
      abortController.abort();
    }
  });

  async function update(signal) {
    while (true) {
      signal.throwIfAborted();
      status.textContent = "正在更新...";
      const res = await fetch(`https://forum.gamer.com.tw/ajax/moreCommend.php?bsn=${bsn}&snB=${snb}&returnHtml=1`, {signal});
      const data = await res.json();
      const lastCommentId = el.children.length ? Number(el.children[el.children.length - 1].id.match(/\d+/)[0]) : null;
      const comments = lastCommentId ? data.html.filter(h => {
        const id = h.match(/id="Commendcontent_(\d+)"/)[1];
        if (!id) throw new Error("無法取得推文 ID");
        return Number(id) > Number(lastCommentId);
      }) : data.html;
      el.insertAdjacentHTML("beforeend", comments.join(""));
      await Promise.race(
        [
          Promise.all([delay(60000, signal), pageVisible()]),
          rejectIfAborted(signal)
        ]
      );
    }
  }

  async function delay(ms, signal) {
    const end = Date.now() + ms;
    while (true) {
      signal.throwIfAborted();
      const remain = end - Date.now();
      if (remain <= 0) break;
      status.textContent = `下一次更新約在 ${Math.round(remain / 1000)} 秒後`;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
});


function pageVisible() {
  if (document.visibilityState === "visible") return Promise.resolve();
  return new Promise(resolve => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        resolve();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
  });
}

function rejectIfAborted(signal) {
  return new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(new Error("已停止實況")), {once: true});
  });
}


