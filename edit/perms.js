/* Elorae edit mode: permission helpers shared by the browser editor (edit/editor.js)
   and the server-side guard (edit/guard.js). No secrets live here or anywhere in the repo. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EloraeEditPerms = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Paths only an admin may change (the edit system itself, workflows, ownership rules).
  var PROTECTED = ["edit/**", ".github/**", "CODEOWNERS", "docs/CODEOWNERS"];

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

  function permList(profile) {
    if (!profile) return [];
    var p = profile.permissions;
    if (typeof p === "string") p = [p];
    return Array.isArray(p) ? p.filter(function (x) { return typeof x === "string" && x && x !== "view"; }) : [];
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
    return permList(profile).some(function (g) { return matches(g, path); });
  }

  function saveMode(profile) {
    if (!profile) return "pr";
    if (profile.save === "direct" || profile.save === "pr") return profile.save;
    return isAdmin(profile) ? "direct" : "pr";
  }

  return {
    PROTECTED: PROTECTED,
    globToRegExp: globToRegExp,
    matches: matches,
    normPath: normPath,
    profilesOf: profilesOf,
    profileFor: profileFor,
    isAdmin: isAdmin,
    permList: permList,
    isProtected: isProtected,
    canEdit: canEdit,
    saveMode: saveMode
  };
});
