let map;  // 全域地圖物件

function initMap() {
  console.log("init map");
  map = L.map('map').setView([x, y], 17);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '© OpenStreetMap'
  }).addTo(map);
}
// 顯示載入動畫
function showSpinner() {
  document.getElementById("spinner-overlay").style.display = "flex";
}

// 隱藏載入動畫
function hideSpinner() {
  document.getElementById("spinner-overlay").style.display = "none";
}

// 在地圖上繪製扇形區域
// 在 Leaflet 地圖上畫出一個由中心點、角度和半徑決定的扇形區塊
function drawSegment(latCenter, lngCenter, angle1Rad, angle2Rad, r1, r2, fillColor) {
    const p1 = [
        latCenter + (r1 * Math.sin(angle1Rad)) / 111111,
        lngCenter + (r1 * Math.cos(angle1Rad)) / (111111 * Math.cos(latCenter * Math.PI / 180))
    ];
    const p2 = [
        latCenter + (r1 * Math.sin(angle2Rad)) / 111111,
        lngCenter + (r1 * Math.cos(angle2Rad)) / (111111 * Math.cos(latCenter * Math.PI / 180))
    ];
    const p3 = [
        latCenter + (r2 * Math.sin(angle2Rad)) / 111111,
        lngCenter + (r2 * Math.cos(angle2Rad)) / (111111 * Math.cos(latCenter * Math.PI / 180))
    ];
    const p4 = [
        latCenter + (r2 * Math.sin(angle1Rad)) / 111111,
        lngCenter + (r2 * Math.cos(angle1Rad)) / (111111 * Math.cos(latCenter * Math.PI / 180))
    ];
    L.polygon([p1, p2, p3, p4], {
        color: null,
        weight: 0,
        fillColor,
        fillOpacity: 1.0
    }).addTo(map);
}

// ✅ 三扇形樣式
function drawTriangle(center, radius, angleCenter, angleSpan, progressInput, maxSegments = 5, label) {
    const latCenter = parseFloat(center[0]);
    const lngCenter = parseFloat(center[1]);

    const segmentLength = radius / maxSegments;

    const angle1 = angleCenter - angleSpan / 2;
    const angle2 = angleCenter + angleSpan / 2;

    const angle1Rad = angle1 * Math.PI / 180;
    const angle2Rad = angle2 * Math.PI / 180;

    // ✅ 處理百分比輸入，可以是 "40%" 或 40
    let percent = 0;
    if (typeof progressInput === 'string' && progressInput.includes('%')) {
        percent = parseFloat(progressInput.replace('%', '')) || 0;
    } else {
        percent = parseFloat(progressInput) || 0;
    }
    percent = Math.max(0, Math.min(percent, 100));

    const exactProgress = (percent / 100) * maxSegments;
    const fullSegments = Math.floor(exactProgress);
    const partialRatio = exactProgress - fullSegments;

    // ✅ 畫所有區段
    for (let i = 0; i < maxSegments; i++) {
        const rStart = i * segmentLength;
        const rEnd = (i + 1) * segmentLength;

        if (i < fullSegments) {
            drawSegment(latCenter, lngCenter, angle1Rad, angle2Rad, rStart, rEnd, 'blue');
        } else if (i === fullSegments && partialRatio > 0) {
            const rBlue = rStart + segmentLength * partialRatio;
            drawSegment(latCenter, lngCenter, angle1Rad, angle2Rad, rStart, rBlue, 'blue');
            drawSegment(latCenter, lngCenter, angle1Rad, angle2Rad, rBlue, rEnd, 'green');
        } else {
            drawSegment(latCenter, lngCenter, angle1Rad, angle2Rad, rStart, rEnd, 'green');
        }
    }

    // ✅ 畫黑色外框三角形
    const tip = [latCenter, lngCenter];
    const edge1 = [
        latCenter + (radius * Math.sin(angle1Rad)) / 111111,
        lngCenter + (radius * Math.cos(angle1Rad)) / (111111 * Math.cos(latCenter * Math.PI / 180))
    ];
    const edge2 = [
        latCenter + (radius * Math.sin(angle2Rad)) / 111111,
        lngCenter + (radius * Math.cos(angle2Rad)) / (111111 * Math.cos(latCenter * Math.PI / 180))
    ];

    L.polygon([tip, edge1, edge2], {
        color: 'black',
        fillOpacity: 0.0,
        weight: 1
    }).addTo(map).bindPopup(label);
}

// ✅ 正三角形樣式
function drawEquilateralTriangle(centerTarget, radius, directionDeg, color, label) {
    const latCenter = parseFloat(centerTarget[0]);
    const lngCenter = parseFloat(centerTarget[1]);

    const baseAngles = [0, 120, 240].map(a => a + directionDeg);
    const triangle = baseAngles.map(angle => {
        const rad = angle * Math.PI / 180;
        const dx = radius * Math.cos(rad);
        const dy = radius * Math.sin(rad);
        const lat = dy / 111111;
        const lng = dx / (111111 * Math.cos(latCenter * Math.PI / 180));
        return [lat, lng];
    });

    const centroid = triangle.reduce(
        (acc, p) => [acc[0] + p[0], acc[1] + p[1]],
        [0, 0]
    ).map(sum => sum / 3);

    const dLat = latCenter - centroid[0];
    const dLng = lngCenter - centroid[1];
    const shifted = triangle.map(p => [p[0] + dLat, p[1] + dLng]);

    const polygon = L.polygon(shifted, {
        color: "black",
        fillColor: color,
        fillOpacity: 1.0,
        weight: 1
    }).addTo(map).bindPopup(label);

    polygon.bringToBack();  // 放到底層

    return polygon;
}

// Excel最後更新時間
function updateTimestamp() {
  const el = document.getElementById("last-updated");
  if (!el) return;
  const now = new Date();
  el.textContent = `最後更新：${now.toLocaleString('zh-TW')}`;
}

// 清除圖層
function clearMapLayers() {
  map.eachLayer(layer => {
    if (layer instanceof L.Marker || layer instanceof L.Polygon || layer instanceof L.CircleMarker) {
      map.removeLayer(layer);
    }
  });
}

function drawMapFromData(data) {
    if (!Array.isArray(data) || data.length === 0) {
        console.warn("資料格式不正確或資料為空");
        return;
    }

    clearMapLayers();
    const points = [];

    data.forEach(row => {
        if (!row.latitude || !row.longitude) {
            console.warn("缺少經緯度資料", row);
            return;
        }

        const lat = parseFloat(row.latitude);
        const lng = parseFloat(row.longitude);
        const pt = [lat, lng];
        const id = row.ID || row.SITEID || '';
        const type = row.type || '';
        points.push(pt);

        console.log("繪製點:", pt); // 查看每個繪製的點

        // 暫時不顯示紅點（客訴預測點）
        // if (type === "red_dot") {
        //     L.circleMarker(pt, {
        //         radius: 6,
        //         color: 'red',
        //         fillColor: 'red',
        //         fillOpacity: 0.8
        //     }).addTo(map).bindPopup("客訴預測點");
        // } else {
        if (type === "target") {
            const angle = parseFloat(row["天線方向"]);
            if (!isNaN(angle)) {
                drawTriangle(pt, 50, angle, 30, row["5G"], 5, `天線方向:${row["天線方向"]}°<br>5G: ${row["5G"]}%`);
            }
            const triangleColor = "yellow";
            drawEquilateralTriangle(pt, 20, 90, triangleColor, `SITEID: ${id}<br>站名: ${row["基站名稱"]}`);
        }

        // 這邊是鄰近站，不顯示所以略過
        // else {
        //     const triangleColor = "green";
        //     drawEquilateralTriangle(pt, 20, 90, triangleColor, `SITEID: ${id}<br>站名: ${row["基站名稱"]}`);
        // }
        // }
    });

    if (points.length > 0) {
        map.fitBounds(points, { padding: [20, 20] });
    }

    updateTimestamp();
}

// 🙅‍♂️🙅‍♂️ 簡化的快取函數 - 使用原生 sessionStorage (目前沒在用, 之後刪掉!!!!
function storeMapData(data) {
    try {
        const dataToStore = {
            data: data,
            timestamp: Date.now(),
            version: '1.0'
        };
        sessionStorage.setItem("mapData", JSON.stringify(dataToStore));
        console.log("資料已儲存到 sessionStorage");
    } catch (e) {
        console.error("儲存資料失敗:", e);
        // 如果儲存失敗（可能是空間不足），清理舊資料再試一次
        clearOldCache();
        try {
            sessionStorage.setItem("mapData", JSON.stringify(dataToStore));
        } catch (e2) {
            console.error("再次儲存資料失敗:", e2);
        }
    }
}

function getMapData() {
    try {
        const stored = sessionStorage.getItem("mapData");
        if (!stored) {
            console.log("無 sessionStorage 快取資料");
            return null;
        }
        
        const parsed = JSON.parse(stored);
        if (!parsed || !parsed.data || !Array.isArray(parsed.data)) {
            console.warn("快取資料格式不正確");
            sessionStorage.removeItem("mapData");
            return null;
        }
        
        // 檢查資料是否過期（例如：1小時過期）
        const now = Date.now();
        const maxAge = 60 * 60 * 1000; // 1小時（毫秒）
        if (parsed.timestamp && (now - parsed.timestamp) > maxAge) {
            console.log("快取資料已過期，清除快取");
            sessionStorage.removeItem("mapData");
            return null;
        }
        
        console.log("使用 sessionStorage 快取資料");
        return parsed.data;
    } catch (e) {
        console.error("讀取快取資料失敗:", e);
        sessionStorage.removeItem("mapData");
        return null;
    }
}

// 🙅‍♂️🙅‍♂️ 清除所有快取
function clearOldCache() {
    const keys = ["mapData", "lastQueryInputs", "queryResult", "dnList"];
    keys.forEach(key => {
        sessionStorage.removeItem(key);
    });
    console.log("已清除所有 sessionStorage 快取");
}

// 🙅‍♂️🙅‍♂️ 檢查快取狀態（除錯用）
function checkCacheStatus() {
    const cached = getMapData();
    if (cached && Array.isArray(cached)) {
        console.log(`快取狀態：有效，共 ${cached.length} 筆資料`);
        return true;
    } else {
        console.log("快取狀態：無效或不存在");
        return false;
    }
}
/// 🙅 recheck~~
// 🙅‍♂️🙅‍♂️ 改進的 reloadMapData 函數
function reloadMapData(forceReload = false) {
    console.log(`開始載入地圖資料，強制重新載入: ${forceReload}`);
    showSpinner();

    // 如果不是強制重新載入，先檢查快取
    if (!forceReload) {
        const cached = getMapData();
        if (cached && Array.isArray(cached)) {
            try {
                console.log("使用快取資料繪製地圖");
                drawMapFromData(cached);
                hideSpinner();
                return;
            } catch (error) {
                console.warn("使用快取資料時出錯，將重新從伺服器載入", error);
                clearOldCache();
            }
        }
    } else {
        // 強制重新載入時清除快取
        clearOldCache();
    }
    
    // 從伺服器載入資料
    console.log("從伺服器載入資料");
    
    // 構建請求 URL，如果強制重新載入，加上參數告知後端
    const url = forceReload ? '/data?force_reload=true' : '/data';
    
    fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': forceReload ? 'no-cache' : 'default'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("從伺服器收到的資料：", data);
        
        // 驗證資料格式
        if (!Array.isArray(data)) {
            throw new Error("伺服器返回的資料格式不正確");
        }
        
        // 儲存到快取
        storeMapData(data);
        
        // 繪製地圖
        drawMapFromData(data);
        
        console.log("地圖載入完成");
    })
    .catch(error => {
        console.error("資料載入失敗:", error);
        alert(`資料載入失敗: ${error.message}`);
        
        // 如果是網路錯誤，嘗試使用快取資料
        if (!forceReload) {
            const cached = getMapData();
            if (cached && Array.isArray(cached)) {
                console.log("使用快取資料作為備用");
                drawMapFromData(cached);
                return;
            }
        }
    })
    .finally(() => {
        hideSpinner();
    });
}
/// 🙅

// ✅ 添加重新載入按鈕事件監聽器
function initReloadButton() {
    const reloadBtn = document.getElementById("reload-btn");
    if (reloadBtn) {
        reloadBtn.addEventListener("click", () => {
            console.log("使用者點擊重新載入按鈕");
            reloadMapData(true); // 強制重新載入
        });
        console.log("重新載入按鈕事件監聽器已設置");
    } else {
        console.warn("找不到 reload-btn 元素");
    }
}

// ✅ 初始化
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM 載入完成，開始初始化");
    initMap();
    initReloadButton(); // 初始化重新載入按鈕
    reloadMapData(); // 初始載入資料

  // 綁定搜尋按鈕事件 (假設你的 HTML 有一個 id="search-btn" 的按鈕)
  const searchBtn = document.getElementById("search-btn");
  if (searchBtn) {
    searchBtn.addEventListener("click", searchBySiteid);
  }
});

// ✅ 全域函數，方便在控制台除錯
window.debugMapCache = {
    checkStatus: checkCacheStatus,
    clearCache: clearOldCache,
    reloadData: reloadMapData,
    getData: getMapData
};
