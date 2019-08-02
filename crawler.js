/**
 * Invoque esse script passando o page_id. Por example:
 *
 * `node crawler.js 223`
 *
 * Good hacking :)
 */

const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
  const pageId = process.argv[2];

  const browser = await puppeteer.launch({ headless: false, devtools: true });
  const page = await browser.newPage();
  await page.goto("https://hipsters.tech/?page_id=" + pageId);

  const result = await page.evaluate(async () => {
    let scrollBotton = () => window.scrollTo(0, 99999999);
    let sleep = milli =>
      new Promise((resolve, reject) => setTimeout(resolve, milli));

    let title = document.querySelector(".entry-title").textContent;
    let releaseDate = document.querySelector(".entry-date").textContent;

    let tags = Array.from(document.querySelectorAll(".post-meta ul li a"))
      .map(a => a.textContent)
      .filter(t => t.toLowerCase().indexOf("comentário") == -1);

    let people = Array.from(
      document.querySelectorAll(".entry-content ul")[1].childNodes
    )
      .map(li => {
        if (li.querySelector) {
          let a = li.querySelector("a");
          if (a) {
            return a.textContent;
          } else {
            return li.textContent.split(",")[0];
          }
        }
      })
      .filter(e => e);

    scrollBotton();
    await sleep(8000);

    let comments = [];
    let hasCommentsOnPage = document.querySelector(".comments-area");
    if (hasCommentsOnPage) {
      console.log("has comments on the page!");
      comments = Array.from(
        document.querySelectorAll(".comments-area li.comment")
      ).map(c => {
        return {
          author: c.querySelector(".commenter").textContent,
          comment: c.querySelector(".comment-content").textContent
        };
      });
    }

    let disqus = hasCommentsOnPage
      ? null
      : document.querySelector("#disqus_thread");

    let disqusUrl = null;

    if (disqus) {
      disqus.scrollIntoView();
      await sleep(3000);
      let iframe = disqus.querySelector("iframe");
      if (iframe) {
        disqusUrl = iframe.src;
      } else {
        console.log("não consegui encontrar iframe...");
        console.log(disqus);
        console.log(disqus.querySelector("iframe"));
        await sleep(2500);
        iframe = disqus.querySelector("iframe");
        if (iframe) {
          disqusUrl = iframe.src;
        }
      }
    }

    return { title, releaseDate, tags, people, disqusUrl, comments };
  });

  if (result.disqusUrl) {
    console.log("now were visting disqus...");

    await page.goto(result.disqusUrl);
    const comments = await page.evaluate(async () => {
      var scrollBotton = () => {
        console.log("scrolling to bottom...");
        window.scrollTo(0, 9999999999);
      };
      var sleep = milli =>
        new Promise((resolve, reject) => setTimeout(resolve, milli));

      var clickLoadMore = async () => {
        scrollBotton();
        await sleep(8000);
        scrollBotton();

        let loadMore = document.querySelector('[data-action="more-posts"]');
        if (loadMore) {
          let isVisible = loadMore.getBoundingClientRect().height > 0;
          if (isVisible) {
            loadMore.click();
            await clickLoadMore();
          }
        }
      };

      await clickLoadMore();

      return Array.from(document.querySelectorAll(".post")).map(p => {
        return {
          author: p.querySelector(".author [data-username]").textContent,
          comment: p.querySelector(".post-message").textContent
        };
      });
    });

    result.comments = comments;
  }

  fs.writeFileSync("data/" + pageId + ".json", JSON.stringify(result));

  await browser.close();
})();
