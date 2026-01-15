(() => {
    document.addEventListener('DOMContentLoaded', () => {
        /** 读取 URL hash 并构造资源路径 */
        const idx = location.hash.slice(1).split('?')[0];
        let bookNumber = idx.replace("NCE", "")
        if (!bookNumber) {
            bookNumber = 1
        }
        let lessonsData = {}
        document.getElementById(`book-${bookNumber}`).classList.add('active');

        loadData().then(() => {
            // 初始化所有课文列表
            for (let i = 1; i <= 4; i++) {
                generateLessons(i);
            }
        })

        async function loadData() {
            const dataSrc = 'static/data.json';
            const dataRes = await fetch(dataSrc);
            lessonsData = await dataRes.json();
        }

        // 生成课文列表的函数
        function generateLessons(bookNumber) {
            const container = document.getElementById(`book-${bookNumber}-lessons`);
            const lessons = lessonsData[bookNumber];

            container.innerHTML = '';
            lessons.forEach((lesson, index) => {
                let lessonNumber = index + 1
                if (bookNumber === 1) {
                    lessonNumber = index * 2 + 1;
                    lessonNumber = `${lessonNumber}&${lessonNumber+1}`;
                }
                const lessonElement = document.createElement('a');
                lessonElement.href = `lesson.html#NCE${bookNumber}/${lesson.filename}`;
                lessonElement.className = 'lesson-item';
                lessonElement.innerHTML = `
                    <span class="lesson-number">第${lessonNumber}课</span>
                    <span class="lesson-title">${lesson.title}</span>
                `;
                container.appendChild(lessonElement);
            });
        }

    })
})()