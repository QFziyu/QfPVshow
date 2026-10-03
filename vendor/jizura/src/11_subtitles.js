/* Import timestamped subtitle files into the editor's persistent lyric syntax. */
(() => {
'use strict';
J.importSubtitles = (raw, name) => {
  const text = String(raw).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  const stamp = t => '[' + Math.floor(t / 60) + ':' + (t % 60).toFixed(3).padStart(6, '0') + ']';
  if (/\.srt$/i.test(name)) {
    const rows = [];
    const time = s => {
      const m = s.match(/^(\d+):(\d{2}):(\d{2})[,.](\d{3})$/);
      if (!m || +m[2] >= 60 || +m[3] >= 60) throw new Error('SRT 时间格式无效');
      return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
    };
    for (const block of text.split(/\n\s*\n/)) {
      const lines = block.trim().split('\n');
      if (/^\d+$/.test(lines[0])) lines.shift();
      const m = (lines.shift() || '').match(/^(\S+)\s*-->\s*(\S+)(?:\s+.*)?$/);
      if (!m) throw new Error('SRT 字幕块缺少有效时间范围');
      const start = time(m[1]), end = time(m[2]);
      if (end <= start) throw new Error('字幕结束时间必须晚于开始时间');
      const lyric = lines.join(' ').replace(/<[^>]*>/g, '').trim();
      if (lyric) rows.push({ start, end, lyric });
    }
    if (!rows.length) throw new Error('文件没有可导入的字幕');
    rows.sort((a, b) => a.start - b.start);
    return rows.map(r => stamp(r.start) + '[end:' + r.end + ']' + r.lyric).join('\n');
  }
  if (!/\.lrc$/i.test(name)) throw new Error('请选择 .lrc 或 .srt 文件');
  const offset = text.match(/\[offset:([+-]?\d+)\]/i);
  const shift = offset ? +offset[1] / 1000 : 0;
  const rows = [];
  for (const line of text.split('\n')) {
    let rest = line.trim(), m; const times = [];
    while ((m = rest.match(/^\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]/))) {
      if (+m[2] >= 60) throw new Error('LRC 秒数必须小于 60');
      times.push(Math.max(0, +m[1] * 60 + +m[2] + (m[3] ? +('0.' + m[3]) : 0) + shift));
      rest = rest.slice(m[0].length);
    }
    if (!times.length && (!rest || /^\[(ti|ar|al|by|offset|length|re|ve):.*\]$/i.test(rest))) continue;
    if (!times.length) throw new Error('LRC 歌词行缺少有效时间标签');
    // Enhanced LRC word timestamps are removed; line starts remain exact.
    rest = rest.replace(/<\d+:\d+(?:\.\d+)?>/g, '').trim();
    for (const start of times) rows.push({ start, lyric: rest });
  }
  rows.sort((a, b) => a.start - b.start);
  const out = [];
  rows.forEach((r, i) => {
    if (!r.lyric) return; // empty timestamp still ends the preceding line
    const next = rows[i + 1];
    out.push(stamp(r.start) + (next && next.start > r.start ? '[end:' + next.start + ']' : '') + r.lyric);
  });
  if (!out.length) throw new Error('文件没有带时间标签的歌词');
  return out.join('\n');
};
})();
