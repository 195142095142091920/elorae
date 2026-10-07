"use strict";
const assert = require("assert");
const Media = require("../media.js");
const cat0 = { version: 1, media: {} };

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (detail ? " — " + detail : "")); }
}

// JPEG with fake APP1
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x04, 0x45, 0x78, 0xff, 0xda, 0x00, 0x01, 0xff, 0xd9]);
const stripped = Media.stripMetadata(jpeg, "image/jpeg");
check("stripJpegExif removes APP1", stripped.length < jpeg.length && stripped[0] === 0xff && stripped[1] === 0xd8);

const prep = Media.prepareUpload(cat0, { bytes: stripped, mime: "image/jpeg", ext: "jpg", name: "My Hero!.JPG" }, {
  title: "My Hero", tags: ["heroes", "vaerek"], owner: "devin", uploadedBy: "devin", everyone: false, allowed: ["devin", "sawyer"]
});
check("prepareUpload id/path", prep.id === "my-hero" && prep.entry.path === "assets/my-hero.jpg");
check("prepareUpload visibility", prep.entry.allowed.indexOf("devin") >= 0 && prep.entry.allowed.indexOf("sawyer") >= 0 && prep.entry.everyone === false);
check("prepareUpload files", prep.files.length === 2 && prep.files[0].path === Media.CATALOG && prep.files[1].binary && prep.files[1].path === "assets/my-hero.jpg");
check("canSee sawyer", Media.canSee(prep.entry, "sawyer", false));
check("canSee julie denied", !Media.canSee(prep.entry, "julie", false));
check("canSee admin", Media.canSee(prep.entry, "julie", true));
check("srcFromArticle", Media.srcFromArticle("articles/vaerek.html", "assets/my-hero.jpg") === "../assets/my-hero.jpg");

const vis = Media.setVisibility(prep.catalog, prep.id, { everyone: true });
check("setVisibility everyone", vis.media[prep.id].everyone === true);

const prep2 = Media.prepareUpload(prep.catalog, { bytes: stripped, mime: "image/jpeg", ext: "jpg", name: "My Hero.jpg" }, { title: "My Hero", owner: "devin" });
check("unique id on collision", prep2.id === "my-hero-2" && prep2.entry.path === "assets/my-hero-2.jpg");

check("cleanFilename", Media.cleanFilename("../etc/passwd.png", "png") === "etcpasswd.png" || Media.cleanFilename("Hello World.PNG", "png") === "hello-world.png");
check("cleanFilename hello", Media.cleanFilename("Hello World.PNG", "png") === "hello-world.png");


const seeded = Media.seedFromAssetPaths(cat0, [
  "assets/Vaerek, At Ease.png",
  "assets/lore-blur/vaerek.jpg",
  "assets/Heldranc Flies.png",
  "not-an-asset.gif",
  "assets/Vaerek, At Ease.png"
], { everyone: true });
check("seedFromAssetPaths adds top-level only", seeded.added.length === 2 && seeded.catalog.media["vaerek-at-ease"] && seeded.catalog.media["heldranc-flies"]);
check("seedFromAssetPaths skips subfolders/dupes", seeded.skipped >= 2);
check("seedFromAssetPaths everyone", seeded.catalog.media["vaerek-at-ease"].everyone === true);
check("isAssetImagePath", Media.isAssetImagePath("assets/Foo.png") && !Media.isAssetImagePath("assets/lore-blur/x.jpg"));

console.log("\n" + pass + "/" + (pass + fail) + " passed");
process.exit(fail ? 1 : 0);
