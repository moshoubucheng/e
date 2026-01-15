(() => {
    document.addEventListener('DOMContentLoaded', () => {

        /** 正则常量 */
        const LINE_RE = /\[(\d+:\d+\.\d+)\](.*)/;
        const TIME_RE = /\[(\d+):(\d+(?:\.\d+)?)\]/;
        const INFO_RE = {
            album: /\[al:(.*)\]/,
            artist: /\[ar:(.*)\]/,
            title: /\[ti:(.*)\]/,
            by: /\[by:(.*)\]/
        };

        /** 读取 URL hash 并构造资源路径 */
        const filename = location.hash.slice(1).split('?')[0];
        if (!filename) {
            window.location.href = "book.html"
        }
        const book = filename.split('/').shift()
        const bookScr = `book.html#${book}`;
        const bookImgSrc = `images/${book}.jpg`;
        const mp3Src = `${filename}.mp3`;
        const lrcSrc = `${filename}.lrc`;

        /** DOM 引用 */
        const audio = document.getElementById('player');
        const content = document.getElementById('content');
        const bookEl = document.getElementById('book');
        const bookTitleEl = document.getElementById('book-title');
        const bookImgEl = document.getElementById('book-img');
        const lessonTitleEl = document.getElementById('lesson-title');
        const lessonLRCByEl = document.getElementById('lesson-lrc-by');

        /** 数据结构 */
        const state = {
            data: [],          // [{en, cn, start, end}]
            album: '',
            artist: '',
            title: '',
            by: '',
            segmentEnd: 0,
            activeIdx: -1
        };
        audio.src = mp3Src;
        bookImgEl.src = bookImgSrc;
        bookImgEl.alt = book;

        /** -------------------------------------------------
         *  元信息解析
         * ------------------------------------------------- */
        function parseInfo(line) {
            for (const key in INFO_RE) {
                const m = line.match(INFO_RE[key]);
                if (m) state[key] = m[1];
            }
        }

        /** -------------------------------------------------
         *  时间解析
         * ------------------------------------------------- */
        function parseTime(tag) {
            const m = TIME_RE.exec(tag);
            return m ? parseInt(m[1], 10) * 60 + parseFloat(m[2]) - 0.5 : 0;
        }

        /** -------------------------------------------------
         *  LRC 解析
         * ------------------------------------------------- */
        async function loadLrc() {
            const lrcRes = await fetch(lrcSrc);
            const text = await lrcRes.text();
            const lines = text.split(/\r?\n/).filter(Boolean);

            lines.forEach((raw, i) => {
                const line = raw.trim();
                const match = line.match(LINE_RE);
                if (!match) {
                    parseInfo(line);
                    return;
                }

                const start = parseTime(`[${match[1]}]`);
                const [en, cn = ''] = match[2].split('|').map(s => s.trim());

                let end = 0;
                for (let j = i + 1; j < lines.length; j++) {
                    const nxt = lines[j].match(LINE_RE);
                    if (nxt) {
                        end = parseTime(`[${nxt[1]}]`);
                        break;
                    }
                }
                state.data.push({en, cn, start, end});
            });
            render();
        }


        /** -------------------------------------------------
         *  渲染
         * ------------------------------------------------- */
        function render() {
            bookEl.href = bookScr;
            bookTitleEl.textContent = state.album;
            lessonTitleEl.textContent = state.title;
            lessonLRCByEl.textContent = state.by;

            const sentencesHTML = state.data.map(
                (item, idx) =>
                    `<div class="sentence" data-idx="${idx}">
                    <div class="en">${item.en}</div>
                    <div class="cn">${item.cn}</div>
                </div>`
            ).join('');
            const footerHTML = `
                        <div class="end">
                            <p>---谢谢支持---</p>
                            <p>❤️❤️❤️</p>
                            <a target="_blank" href="https://sakuradoctor.com"><p>By 呉 福興</p></a>
                        </div>
            `;
            content.innerHTML = sentencesHTML + footerHTML;
        }

        /** -------------------------------------------------
         *  播放区间
         * ------------------------------------------------- */
        function playSegment(start, end) {
            state.segmentEnd = end
            audio.currentTime = start;
            audio.play();
            state.activeIdx = -1;
        }

        /** -------------------------------------------------
         *  高亮 & 自动滚动
         * ------------------------------------------------- */
        function highlight(idx) {
            if (idx === state.activeIdx) return;
            const prev = content.querySelector('.sentence.active');
            if (prev) prev.classList.remove('active');
            const cur = content.querySelector(`.sentence[data-idx="${idx}"]`);
            if (cur) {
                cur.classList.add('active');
                cur.scrollIntoView({behavior: 'smooth', block: 'center'});
            }
            state.activeIdx = idx;
        }

        /** -------------------------------------------------
         *  事件绑定（委托）
         * ------------------------------------------------- */
        content.addEventListener('click', e => {
            const target = e.target.closest('.sentence');
            if (!target) return;
            const idx = Number(target.dataset.idx);
            const {start, end} = state.data[idx];
            playSegment(start, end);
        });

        audio.addEventListener('timeupdate', () => {
            const cur = audio.currentTime;
            // 区间结束自动暂停
            if (state.segmentEnd && cur >= state.segmentEnd) {
                audio.pause();
                audio.currentTime = state.segmentEnd;
                state.segmentEnd = 0;
                state.activeIdx = -1;
                return;
            }

            // 找到当前句子索引
            const idx = state.data.findIndex(
                item => cur > item.start && (cur < item.end || !item.end)
            );
            if (idx !== -1) highlight(idx);
        });

        // 初始化
        loadLrc().then(r => {
        });

    })
})();
