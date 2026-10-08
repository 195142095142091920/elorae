/* Elorae edit mode: permission helpers shared by the browser editor (edit/editor.js)
   and the server-side guard (edit/guard.js). No secrets live here or anywhere in the repo. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EloraeEditPerms = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Paths only an admin may change (the edit system itself, workflows, ownership rules).
  var PROTECTED = ["edit/**", ".github/**", "CODEOWNERS", "docs/CODEOWNERS"];
  // HARD CEILING for every non-admin: only article pages, whatever profiles.json says.
  // A non-admin rule that isn't inside articles/ is ignored (UI) and rejected (guard).
  var NON_ADMIN_CEILING = "articles/*.html";

  // An article's pretty URL copy (articles/x/index.html) is the same page as articles/x.html:
  // rules and the ceiling are checked against the .html name, so players can edit either copy.
  function canonicalPath(path) {
    var p = normPath(path), m = /^articles\/([^/]+)\/index\.html$/.exec(p);
    return m ? "articles/" + m[1] + ".html" : p;
  }
  // The other copy of a page (pretty URL x/index.html <-> x.html), or null.
  function mirrorPath(path) {
    var p = normPath(path), m;
    if ((m = /^(.+)\/index\.html$/.exec(p))) return m[1] + ".html";
    if ((m = /^(.+)\.html$/.exec(p)) && !/(^|\/)index$/.test(m[1])) return m[1] + "/index.html";
    return null;
  }
  function withinCeiling(path) { return matches(NON_ADMIN_CEILING, canonicalPath(path)); }
  // A rule (glob) is acceptable for a non-admin only if it can't reach outside articles/.
  function ruleAllowed(glob) {
    var g = normPath(glob);
    return /^articles\/[^/]*$/.test(g) && !/\*\*/.test(g);
  }

  function globToRegExp(glob) {
    var re = "^";
    for (var i = 0; i < glob.length; i++) {
      var c = glob.charAt(i);
      if (c === "*") {
        if (glob.charAt(i + 1) === "*") {
          // "**/" matches zero or more directories; "**" alone matches anything.
          if (glob.charAt(i + 2) === "/") { re += "(?:.*/)?"; i += 2; }
          else { re += ".*"; i += 1; }
        } else re += "[^/]*";
      } else if (c === "?") re += "[^/]";
      else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
    return new RegExp(re + "$");
  }

  function normPath(p) {
    return String(p || "").replace(/\\/g, "/").replace(/^\.?\//, "").replace(/^\/+/, "");
  }

  function matches(glob, path) {
    return globToRegExp(normPath(glob)).test(normPath(path));
  }

  function profilesOf(doc) {
    var out = {};
    var src = doc && doc.profiles ? doc.profiles : {};
    Object.keys(src).forEach(function (k) {
      if (k.charAt(0) === "_" || k.indexOf("//") === 0) return; // comments / examples
      out[k.toLowerCase()] = src[k];
    });
    return out;
  }

  function profileFor(doc, login) {
    if (!login) return null;
    var p = profilesOf(doc)[String(login).toLowerCase()];
    return p && typeof p === "object" ? p : null;
  }

  function isAdmin(profile) {
    return !!(profile && profile.role === "admin");
  }

  function rawPermList(profile) {
    if (!profile) return [];
    var p = profile.permissions;
    if (typeof p === "string") p = [p];
    return Array.isArray(p) ? p.filter(function (x) { return typeof x === "string" && x && x !== "view"; }) : [];
  }
  // Effective rules: admins keep theirs; non-admins only keep rules inside the ceiling.
  function permList(profile) {
    var l = rawPermList(profile);
    return isAdmin(profile) ? l : l.filter(ruleAllowed);
  }
  // Rules in a non-admin profile that exceed the ceiling (reported by the guard and the UI).
  function rejectedRules(profile) {
    if (!profile || isAdmin(profile)) return [];
    return rawPermList(profile).filter(function (g) { return !ruleAllowed(g); });
  }

  function isProtected(path) {
    return PROTECTED.some(function (g) { return matches(g, path); });
  }

  // Can this profile write this repo path?
  function canEdit(profile, path) {
    if (!profile) return false;
    path = normPath(path);
    if (!path) return false;
    if (isProtected(path)) return isAdmin(profile);
    if (isAdmin(profile)) return true;
    if (!withinCeiling(path)) return false;
    var c = canonicalPath(path);
    return permList(profile).some(function (g) { return matches(g, c); });
  }
  // A player who owns this page (listed by exact path, not via a glob) may also edit its
  // hero name and epithet; admins always may.
  function ownsPage(profile, path) {
    if (!profile) return false;
    if (isAdmin(profile)) return true;
    var c = canonicalPath(path);
    return permList(profile).some(function (g) { return !/[*?]/.test(g) && canonicalPath(g) === c; });
  }

  function saveMode(profile) {
    if (!profile) return "pr";
    if (profile.save === "direct" || profile.save === "pr") return profile.save;
    return isAdmin(profile) ? "direct" : "pr";
  }

  return {
    PROTECTED: PROTECTED,
    NON_ADMIN_CEILING: NON_ADMIN_CEILING,
    withinCeiling: withinCeiling,
    ruleAllowed: ruleAllowed,
    rejectedRules: rejectedRules,
    globToRegExp: globToRegExp,
    matches: matches,
    normPath: normPath,
    profilesOf: profilesOf,
    profileFor: profileFor,
    isAdmin: isAdmin,
    rawPermList: rawPermList,
    permList: permList,
    isProtected: isProtected,
    canEdit: canEdit,
    ownsPage: ownsPage,
    canonicalPath: canonicalPath,
    mirrorPath: mirrorPath,
    saveMode: saveMode
  };
});
