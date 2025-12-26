// 向前端請求使用者輸入資料, 並顯示在畫面上
function queryData() {
    // type 預設 4G(LTE)
    const type = (document.getElementById("type-input")?.value.trim()) || "LTE";
    const siteid = document.getElementById("siteid-input").value.trim();
    const name = document.getElementById("name-input").value.trim();
    const sector = document.getElementById("sector-input").value.trim();
    const errorMsg = document.getElementById("error-msg");
    const output = document.getElementById("query-result");
    const fileInfo = document.getElementById("file-info");
    
    
    errorMsg.textContent = "";
    output.innerHTML = "";

    if (!type && !siteid && !name && !sector) {
        errorMsg.textContent = "請至少輸入一個查詢條件。";
        return;
    }

    errorMsg.textContent = "查詢中...";

    const params = new URLSearchParams();
    if (type) params.append("Type", type);
    if (siteid) params.append("SITEID", siteid);
    if (name) params.append("基站名稱", name);
    if (sector) params.append("Sector", sector);

    fetch(`${APP_ROOT}/IOPS_CR/data?${params.toString()}`)
    .then(res => {
        if (!res.ok) {
            return res.json().then(errorData => {
                throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
            }).catch(() => {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            });
        }
        return res.json();
    })
    .then(response => {
        errorMsg.textContent = "";

        if (response.error) {
            errorMsg.textContent = response.error;
            return;
        }

        // 儲存查詢結果與欄位輸入
        let columns = response.columns || [];
        let data = response.data || [];
        columns = columns.filter(col => col !== "DN");

        const hiddenColumns = ["Type","Sector"];

        columns = columns.filter(col => !hiddenColumns.includes(col));
        
        const dnList = response.dn_list || []; 

        // 顯示文件最後修改時間
        if (response.last_modified && fileInfo) {
            fileInfo.textContent = response.last_modified;
        }

        generateOrderedTable(columns, data, output);
       
        // 將查詢結果整理成 queryInfo 物件，直接傳給 fetchTATrend
        const queryInfo = {
            dn_list: dnList,
            siteid: siteid,
            sector: sector
        };

        // fetchTATrend(queryInfo);
        // fetch85Percent(queryInfo);
        // if (typeof fetchTATrend === "function") {
        //     fetchTATrend(queryInfo);
        // }
        // if (typeof fetch85Percent === "function") {
        //     fetch85Percent(queryInfo);
        // }
    })
    .catch(err => {
        errorMsg.textContent = "查詢失敗：" + err.message;
        console.error("查詢錯誤:", err);
    });

}

const columnDisplayMap = {
    "e/gNodeB_id": "e/gNB_id",
    "天線方向": "AntAzi",
    "RETANGLE": "RET",
    "idleLBPercentageOfUe": "idleLB%UE",
    "idleLBPercCaUe": "idleLBCaUE",
    "inactivityTimer": "InactTmr"
};

function generateOrderedTable(columns, data, outputElement) {
    if (!data || data.length === 0) return;

    let html = '<table class="result-table"><thead><tr>';
    columns.forEach(column => {
        const displayName = columnDisplayMap[column] || column; // 對應顯示名稱，沒有對應就用原名
        html += `<th>${escapeHtml(displayName)}</th>`;
    });
    html += '</tr></thead><tbody>';

    data.forEach(row => {
        html += '<tr>';
        columns.forEach(column => {
            const value = row[column];
            const displayValue = value === null || value === undefined ? '' : String(value);
            html += `<td>${escapeHtml(displayValue)}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';

    outputElement.innerHTML = html;
}


function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function downloadChart(event) {
    // 這個函式是綁在 <button> 上，避免觸發預設提交/跳轉
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    console.log("🟢 downloadChart() triggered");

    // 獲取原始 Canvas
    const originalCanvas = document.getElementById("ta-chart");
    if (!originalCanvas) {
        console.error("❌ 錯誤：找不到 ID 為 'ta-chart' 的 Canvas 元素。");
        alert("無法下載圖表：找不到 Canvas。");
        return;
    }

    const width = originalCanvas.width;
    const height = originalCanvas.height;
    const titleHeight = 40; // 為標題預留的高度

    // 取得 siteId / sector
    let siteId = "";
    let sector = "";
    try {
        const lastInputs = JSON.parse(sessionStorage.getItem("lastQueryInputs") || "{}");
        siteId = lastInputs.siteid || "";
        sector = lastInputs.sector || "";
    } catch (e) {
        console.error("⚠️ sessionStorage 解析失敗：", e);
    }

    // 格式化 sector
    const formattedSector = /^\d+$/.test(sector) ? `S${sector}` : sector;

    console.log("🔍 Debug Info:", { siteId, sector, formattedSector });

    // 創建新 Canvas
    const newCanvas = document.createElement("canvas");
    newCanvas.width = width;
    newCanvas.height = height + titleHeight;
    const ctx = newCanvas.getContext("2d");

    // 背景白色
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);

    // 標題
    const title = `📈 TA 趨勢圖${siteId || formattedSector ? " - " + [siteId, formattedSector].filter(Boolean).join("_") : ""}`;
    ctx.fillStyle = '#000';  
    ctx.font = "bold 20px Arial";
    ctx.textAlign = 'center';
    ctx.fillText(title, newCanvas.width / 2, 30);

    // 繪製圖表
    try {
        ctx.drawImage(originalCanvas, 0, titleHeight);
    } catch (e) {
        console.error("❌ Canvas 繪製失敗：", e);
        alert("無法下載圖表：Canvas 繪製錯誤。");
        return;
    }

    // 檔名處理
    const sanitize = (str) => str.replace(/[^a-zA-Z0-9-_]/g, "_");
    const today = new Date().toISOString().slice(0,10).replace(/-/g,"");
    const parts = [siteId, formattedSector].filter(Boolean).map(sanitize);
    const fileName = [...parts, "TA_Trend", today].join("_") + ".png";

    console.log("💾 FileName ready:", fileName);

    // 下載圖片
    try {
        const link = document.createElement("a");
        link.download = fileName;
        link.href = newCanvas.toDataURL("image/png");
        document.body.appendChild(link); // 確保能被點擊
        link.click();
        document.body.removeChild(link);
        console.log("✅ 圖表下載完成");
    } catch (e) {
        console.error("❌ 生成下載失敗：", e);
        alert("無法下載圖表：下載錯誤。");
    }
}


function clearSession() {
    sessionStorage.removeItem("queryResult");
    sessionStorage.removeItem("lastQueryInputs");
    sessionStorage.removeItem("dnList"); // 新增：清除 dnList
    window.location.href = APP_ROOT + '/';
}

let cachedMapData = null;
// 🙅‍♂️🙅‍♂️
function reloadMapData(forceReload = false) {
  showSpinner();
  // 沒有cachedMapData
  if (cachedMapData && !forceReload) {
    drawMapFromData(cachedMapData);
    hideSpinner();
    updateTimestamp();
    return;
  }

  fetch(APP_ROOT + '/data')
    .then(res => res.json())
    .then(data => {
      cachedMapData = data;
      drawMapFromData(data);
    })
    .catch(err => {
      alert("資料載入失敗");
      console.error(err);
    })
    .finally(() => {
      hideSpinner();
    });
}

// 綁定查詢按鈕點擊
document.getElementById("query-btn").addEventListener("click", queryData);

const inputs = ['type-input', 'siteid-input', 'name-input', 'sector-input'];
inputs.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                queryData();
            }
        });
    }
});
