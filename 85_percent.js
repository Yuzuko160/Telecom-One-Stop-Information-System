 (function() {
    let currentSiteId = "";
    let currentFormattedSector = "";

    // 向前端路由請求已處理完的dn_list資料, 並顯示在前端上
    function fetch85Percent(queryInfo) {
        const percentileStatusElem = document.getElementById("percentile-status");
        percentileStatusElem.textContent = "85 分位圖生成中...";

        const dnList = Array.isArray(queryInfo.dn_list) ? queryInfo.dn_list : [];
        const siteid = queryInfo.siteid || '';
        const sector = queryInfo.sector || '';

        console.log("查詢 85 分位圖參數：", { dnList, siteid, sector });

        fetch(APP_ROOT + "/percentile/data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dn_list: dnList, siteid, sector })
        })
        .then(res => res.json())
        .then(data => {
            percentileStatusElem.textContent = "";
            console.log("85 status 回傳資料：", data);

            if (data.error) {
                percentileStatusElem.textContent = "讀取失敗";
                alert(data.error);
                return;
            }
            //⭐ 固定用前端的 sector，避免後端回來的是大量資料
            // data.siteid是後端的資料，siteid才是前端使用者填的id
            // 傳4個參數就好，85圖不會用到type參數
            drawPercentileChart(data.x, data.series, siteid, sector);
        })
        .catch(err => {
            console.error("❌ fetchTATrend 發生錯誤：", err);
            percentileStatusElem.textContent = "讀取失敗";
        });
    }

    let percentileChart = null;

    function drawPercentileChart(xValues, seriesData, siteId, sector) {
        console.log("=== Draw 85th Percentile Chart Start ===");
        
        // 格式化 sector
        const formattedSector = /^\d+$/.test(sector) ? `S${sector}` : sector;
        
        // 儲存到模組變數，供下載時使用
        currentSiteId = siteId || "";
        currentFormattedSector = formattedSector || "";

        const canvas = document.getElementById("percentile-chart");
        const ctx = canvas.getContext("2d");

        // 移除舊圖表
        if (percentileChart) {
            percentileChart.destroy();
            percentileChart = null;
        }

        // 固定順序
        const colorOrder = ["L700", "L1800", "L2100", "L900", "L2600", "N700", "N3500_60M", "N3500_40M"];

        // 計算累積數值或 85 分位數
        const datasets = colorOrder
            .filter(name => seriesData.hasOwnProperty(name))
            .map(name => {
                const bandData = seriesData[name]; // 該頻段的原始數據
                const totalSum = bandData.reduce((a, b) => a + b, 0); // 該頻段的總和

                // 計算累積百分比
                const data = seriesData[name].map((val, idx) => {
                    // 累積方式：到當前 index 累加 
                    //return seriesData[name].slice(0, idx + 1).reduce((a, b) => a + b, 0);
                    const cumulativeSum = bandData.slice(0, idx + 1).reduce((a, b) => a + b, 0);

                    // 轉換成百分比（除以總和）
                    return totalSum > 0 ? (cumulativeSum / totalSum) * 100 : 0;
                
                });

                return {
                    label: name,
                    data: data,
                    fill: false,
                    borderColor: getColor(name),
                    tension: 0.1
                };
            });

        // 建立圖表
        percentileChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: xValues,
                datasets: datasets
            },
            options: {
                responsive: true,
                animation: false,
                hover: { animationDuration: 0 },
                responsiveAnimationDuration: 0,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { font: { size: 14 } }
                    },
                    annotation: { // 使用 chartjs-plugin-annotation
                        annotations: {
                            line85: {
                                type: 'line',
                                yMin: 85,
                                yMax: 85,
                                borderColor: 'gray',       // 灰色
                                borderWidth: 2,
                                borderDash: [6, 6],
                                label: {
                                    content: '85 分位',
                                    enabled: true,
                                    position: 'end',
                                    font: { size: 12 }
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear', 
                        ticks: { 
                            stepSize: 78, 
                            autoSkip: false, 
                        },
                        title: {
                            display: true,
                            text: '單位: 公尺 (m)',
                            font: { size: 14 },
                            color: '#000000'
                        }
                    },
                    y: {
                        ticks: { font: { size: 14 } },
                        title: {
                            display: true,
                            text: '累積百分比 (%)',
                            font: { size: 14 },
                            color: '#000000'
                        }
                    }
                }
            }
        });

        chartTitle = `${currentSiteId} ${currentFormattedSector} - 85分位圖`;
    }

    // 下載85分位圖png
    function download85Chart(event) {
        // 這個函式是綁在 <button> 上，避免觸發預設提交/跳轉
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        //網頁f12 可查看console除錯日誌
        console.log("=== Download 85Chart Start ===");
        console.log("📌 使用的變數：", { currentSiteId, currentFormattedSector });

        if (!percentileChart) {
            alert("圖表尚未生成！");
            return;
        }

        // 直接使用 drawpercentilechart 模組設定好的兩個變數
        const siteId = currentSiteId;
        const formattedSector = currentFormattedSector;
        
        // 使用實際的圖表畫布。Chart.js 會將畫布存儲在圖表實例中
        const originalCanvas = (percentileChart && percentileChart.canvas) ? percentileChart.canvas : document.getElementById("percentile-chart");

        if (!originalCanvas || !(originalCanvas instanceof HTMLCanvasElement)) {
            alert("找不到畫布！");
            return;
        }

        // 使用畫布的像素尺寸（而不是 CSS 邊界矩形）以獲得清晰的圖像
        const srcWidth = originalCanvas.width;
        const srcHeight = originalCanvas.height;
        const dpr = window.devicePixelRatio || 1;  // 設備像素比率
        const titleSpace = Math.round(50 * dpr);   // 標題空間

        // 建立一個新的畫布，用於下載，具有相同的像素密度
        const newCanvas = document.createElement("canvas");
        newCanvas.width = srcWidth;
        newCanvas.height = srcHeight + titleSpace;
        const ctx = newCanvas.getContext("2d");

        // 白色背景
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);

        // 添加標題
        const title = `📈 85 分位圖${siteId || formattedSector ? " - " + [siteId, formattedSector].filter(Boolean).join("_") : ""}`;
        ctx.fillStyle = '#000';
        ctx.font = `bold ${20 * dpr}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(title, newCanvas.width / 2, Math.round(30 * dpr));

        // 複製圖表
        try {
            // drawImage(source, dx, dy, dWidth, dHeight)
            ctx.drawImage(originalCanvas, 0, titleSpace, srcWidth, srcHeight);
        } catch (e) {
            console.error(e);
            alert("Cannot copy chart!");
            return;
        }

        // 產生檔名
        const clean = str => str.replace(/[^a-zA-Z0-9-_]/g, "_");
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const parts = [siteId, formattedSector].filter(Boolean).map(clean);
        const fileName = [...parts, "85分位圖", today].join("_") + ".png";

        // 下載
        try {
            const link = document.createElement("a");
            link.download = fileName;
            link.href = newCanvas.toDataURL("image/png");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            console.log("✅ 下載成功！");
        } catch (e) {
            console.error("❌ 下載失敗：", e);
            alert("Download failed!");
        }

        console.log("=== Download Chart End ===");
    }

    function getColor(name) {
        const colorMap = {
            L700: '#4BC0C0',
            L1800: '#9966FF',
            L2100: '#FF9F40',
            L900: '#C9CBCF',
            L2600: '#8B0000',
            N700: '#FFCE56',
            N3500_60M: '#FF6384',
            N3500_40M: '#36A2EB',     
        };
        return colorMap[name] || '#000';
    }
    // 暴露需要在全域使用的函數
    window.fetch85Percent = fetch85Percent;
    window.download85Chart = download85Chart;
})();
