export const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

export const parseNames = (text) => {
  if (!text || !text.trim()) return [];
  const lines = text.split("\n").map(function(l) { return l.trim(); }).filter(Boolean);
  var names = [];
  var skip = /versterking|n\.t\.b|coach|trainer|grens|scheids|verzamel|thuis|uit|tegen|wedstrijd/i;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var clean = line.replace(/^[\s\d\.\)\-:;]+/, "").replace(/^[^a-zA-ZÀ-ÿ]+/, "").trim();
    if (!clean || clean.length < 2 || clean.length > 30) continue;
    if (skip.test(clean)) continue;
    if (/^\d+$/.test(clean)) continue;
    var firstName = clean.split(/\s+/)[0];
    if (firstName && firstName.length >= 2) names.push(firstName);
  }
  return names;
};
