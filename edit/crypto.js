/* Elorae visibility layer: client-side encryption for secret pages (WebCrypto only).
   - Each secret's content is encrypted with its own random AES-256-GCM content key.
   - Each person has an RSA-OAEP-3072 keypair. The public key is published in
     edit/visibility.json; the private key is published only ENCRYPTED with a key derived
     from that person's passphrase (PBKDF2-SHA-256, 600k iterations). The passphrase
     never leaves their browser and is never committed.
   - A content key is "wrapped" (RSA-OAEP encrypted) once per allowed person.
   - "Everyone" publishes the raw content key in visibility.json (openKey).
   Shared by the dashboard, the secret viewer and the Node tests. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(globalThis.crypto);
  else root.EloraeCrypto = factory(root.crypto);
})(typeof self !== "undefined" ? self : this, function (C) {
  "use strict";
  var S = C.subtle;
  var PBKDF2_ITER = 600000;
  var RSA = { name: "RSA-OAEP", modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };

  function b64(buf) {
    var u = new Uint8Array(buf), s = "";
    for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(str) {
    var s = atob(str), u = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }
  function utf8(s) { return new TextEncoder().encode(s); }
  function deutf8(b) { return new TextDecoder().decode(b); }
  function rand(n) { var u = new Uint8Array(n); C.getRandomValues(u); return u; }

  function passKey(pass, salt, iter) {
    return S.importKey("raw", utf8(String(pass).normalize("NFKC")), "PBKDF2", false, ["deriveKey"]).then(function (k) {
      return S.deriveKey({ name: "PBKDF2", salt: salt, iterations: iter, hash: "SHA-256" }, k, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    });
  }

  // Create a person's key record from a passphrase. Safe to publish (only the public key and
  // the passphrase-encrypted private key are included).
  function enroll(person, pass) {
    if (!pass || String(pass).length < 12) return Promise.reject(new Error("Use a passphrase of at least 12 characters (four or more random words is best)."));
    var salt = rand(16), iv = rand(12), pair;
    return S.generateKey(RSA, true, ["encrypt", "decrypt"]).then(function (p) {
      pair = p;
      return Promise.all([S.exportKey("jwk", p.publicKey), S.exportKey("pkcs8", p.privateKey), passKey(pass, salt, PBKDF2_ITER)]);
    }).then(function (r) {
      return S.encrypt({ name: "AES-GCM", iv: iv, additionalData: utf8("elorae-person:" + person) }, r[2], r[1]).then(function (ct) {
        var pub = r[0];
        return {
          v: 1, person: person, alg: "RSA-OAEP-3072-SHA256",
          publicKey: { kty: pub.kty, n: pub.n, e: pub.e, alg: "RSA-OAEP-256", ext: true },
          privateKey: { kdf: "PBKDF2-SHA256", iter: PBKDF2_ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) },
          created: new Date().toISOString()
        };
      });
    });
  }

  // Unlock a person's private key with their passphrase. Rejects on a wrong passphrase.
  function unlock(record, pass) {
    var pk = record.privateKey;
    return passKey(pass, unb64(pk.salt), pk.iter).then(function (k) {
      return S.decrypt({ name: "AES-GCM", iv: unb64(pk.iv), additionalData: utf8("elorae-person:" + record.person) }, k, unb64(pk.ct));
    }).then(function (pkcs8) {
      return S.importKey("pkcs8", pkcs8, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"]);
    }, function () { throw new Error("That passphrase does not unlock this key."); });
  }
  function exportPrivate(key) { return S.exportKey("jwk", key); }
  function importPrivate(jwk) { return S.importKey("jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"]); }
  function importPublic(jwk) { return S.importKey("jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]); }

  function newContentKey() { return rand(32); } // raw bytes
  function aesKey(raw, uses) { return S.importKey("raw", raw, { name: "AES-GCM" }, false, uses); }

  function wrapFor(record, rawKey) {
    return importPublic(record.publicKey).then(function (pub) { return S.encrypt({ name: "RSA-OAEP" }, pub, rawKey); }).then(b64);
  }
  function unwrap(privateKey, wrapped) {
    return S.decrypt({ name: "RSA-OAEP" }, privateKey, unb64(wrapped)).then(function (b) { return new Uint8Array(b); });
  }

  // payload: any JSON-serialisable object (e.g. { html }) ; id and epoch are bound as AAD.
  function encryptSecret(id, epoch, rawKey, payload) {
    var iv = rand(12);
    return aesKey(rawKey, ["encrypt"]).then(function (k) {
      return S.encrypt({ name: "AES-GCM", iv: iv, additionalData: utf8("elorae-secret:" + id + ":" + epoch) }, k, utf8(JSON.stringify(payload)));
    }).then(function (ct) {
      return { v: 1, id: id, epoch: epoch, alg: "A256GCM", iv: b64(iv), ct: b64(ct) };
    });
  }
  function decryptSecret(file, rawKey) {
    return aesKey(rawKey, ["decrypt"]).then(function (k) {
      return S.decrypt({ name: "AES-GCM", iv: unb64(file.iv), additionalData: utf8("elorae-secret:" + file.id + ":" + file.epoch) }, k, unb64(file.ct));
    }).then(function (pt) { return JSON.parse(deutf8(pt)); });
  }

  return {
    b64: b64, unb64: unb64, enroll: enroll, unlock: unlock, exportPrivate: exportPrivate, importPrivate: importPrivate,
    newContentKey: newContentKey, wrapFor: wrapFor, unwrap: unwrap, encryptSecret: encryptSecret, decryptSecret: decryptSecret,
    PBKDF2_ITER: PBKDF2_ITER
  };
});
