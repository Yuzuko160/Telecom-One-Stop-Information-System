let map;
let allData = []; // 存放目前週期的全部資料
let targetSiteid = null; // 目前使用者輸入的目標 Siteid

function initMap() {
  console.log("inline script works!");
  map = L.map('map').setView([x, y], 17);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '© OpenStreetMap'
  }).addTo(map);
}

function showSpinner() { document.getElementById("spinner-overlay").style.display = "flex"; }
function hideSpinner() { document.getElementById("spinner-overlay").style.display = "none"; }

// 繪製地圖圖層前清除既有標記與圖形
function clearMapLayers() {
  map.eachLayer(layer => {
    if (layer instanceof L.Marker || layer instanceof L.Polygon || layer instanceof L.CircleMarker) {
      map.removeLayer(layer);
    }
  });
}

// 🙅‍♂️🙅‍♂️
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
    weight: 0,
    fillColor,
    fillOpacity: 1.0
  }).addTo(map);
}

function drawTriangle(center, radius, angleCenter, angleSpan, progressInput, maxSegments = 5, label) {
  const latCenter = parseFloat(center[0]);
  const lngCenter = parseFloat(center[1]);
  const angle1Rad = (angleCenter - angleSpan / 2) * Math.PI / 180;
  const angle2Rad = (angleCenter + angleSpan / 2) * Math.PI / 180;
  const segmentLength = radius / maxSegments;

  let percent = parseFloat(progressInput) || 0;
  percent = Math.max(0, Math.min(percent, 100));
  const exactProgress = (percent / 100) * maxSegments;
  const fullSegments = Math.floor(exactProgress);
  const partialRatio = exactProgress - fullSegments;

  for (let i = 0; i < maxSegments; i++) {
    const rStart = i * segmentLength;
    const rEnd = (i + 1) * segmentLength;

    if (i < fullSegments) {
      // 完整填滿段，顏色依百分比決定
      if (percent <= 30) {
        drawSegment(latCenter, lngCenter, angle1Rad, angle2Rad, rStart, rEnd, 'red');
      } else if (percent >= 70) {
        drawSegment(latCenter, lngCenter, angle1Rad, angle2Rad, rStart, rEnd, 'lightgreen');
      } else {
        drawSegment(latCenter, lngCenter, angle1Rad, angle2Rad, rStart, rEnd, 'blue');
      }
    } else if (i === fullSegments && partialRatio > 0) {
      // 部分填滿段
      const rPartial = rStart + segmentLength * partialRatio;
      if (percent <= 30) {
        drawSegment(latCenter, lngCenter, angle1Rad, angle2Rad, rStart, rPartial, 'red');
        drawSegment(latCenter, lngCenter, angle1Rad, angle2Rad, rPartial, rEnd, 'green'); // 剩餘填綠色
      } else if (percent >= 70) {
        drawSegment(latCenter, lngCenter, angle1Rad, angle2Rad, rStart, rPartial, 'lightgreen');
        drawSegment(latCenter, lngCenter, angle1Rad, angle2Rad, rPartial, rEnd, 'green');
      } else {
        drawSegment(latCenter, lngCenter, angle1Rad, angle2Rad, rStart, rPartial, 'blue');
        drawSegment(latCenter, lngCenter, angle1Rad, angle2Rad, rPartial, rEnd, 'green');
      }
    } else {
      // 剩下未填滿段全部用綠色
      drawSegment(latCenter, lngCenter, angle1Rad, angle2Rad, rStart, rEnd, 'green');
    }
  }



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
  const centroid = triangle.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]).map(sum => sum / 3);
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

// 距離計算（兩點經緯度，單位：公尺）
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // 地球半徑，公尺
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function drawMapFromData(data) {
  if (!Array.isArray(data)) return;
  allData = data; // 更新全域資料

  clearMapLayers();

  // 如果有 targetSiteid，則只畫該站及鄰近站
  if (targetSiteid) {
    const targetStation = data.find(row => row["Siteid"] === targetSiteid);
    if (!targetStation) {
      alert(`找不到 Siteid: ${targetSiteid} 在本週期資料中`);
      return;
    }
    drawStationWithNeighbors(targetStation, data);
  } else {
    // 沒有指定 Siteid，畫整個週期資料（可以選擇只畫 marker 或不畫天線）
    data.forEach(row => drawStationWithNeighbors(row, data, false));
  }
}

// 封裝畫目標站及鄰近站的邏輯
function drawStationWithNeighbors(targetStation, data, showTarget = true) {
  const latTarget = parseFloat(targetStation["緯度"]);
  const lngTarget = parseFloat(targetStation["經度"]);
  const centerPoint = [latTarget, lngTarget];

  // 找出目標站的所有天線方向 row
  const targetRows = data.filter(row => row["Siteid"] === targetStation["Siteid"]);

  if (showTarget) {
    targetRows.forEach(row => {
      const angle = parseFloat(row["天線方向"]) || 90; // 用 row 的方向
      drawTriangle(centerPoint, 50, angle, 30, row["5G"], 5,
                  `目標站 (Siteid: ${row["Siteid"]})<br>天線方向: ${angle}°<br>5G: ${row["5G"]}%`);
    });

      drawEquilateralTriangle(centerPoint, 20, 90, "yellow",
                              `Siteid: ${targetStation["Siteid"]}<br>站名: ${targetStation["SiteName"]}`);
    }

  // 找出 500 公尺內的鄰近站
  const neighbors = data.filter(row => {
    if (row["Siteid"] === targetStation["Siteid"]) return false;
    if (!row["緯度"] || !row["經度"]) return false;
    const lat = parseFloat(row["緯度"]);
    const lng = parseFloat(row["經度"]);
    return distanceMeters(latTarget, lngTarget, lat, lng) <= 500;
  });

  neighbors.forEach(row => {
    const lat = parseFloat(row["緯度"]);
    const lng = parseFloat(row["經度"]);
    const pt = [lat, lng];
    const angle = parseFloat(row["天線方向"]) || 90;
    console.log(row);
    drawTriangle(pt, 50, angle, 30, row["5G"], 5,
                 `鄰近站 (Siteid: ${row["Siteid"]})<br>天線方向: ${angle}°<br>5G: ${row["5G"]}%`);
    drawEquilateralTriangle(pt, 20, 90, "green",
                            `Siteid: ${row["Siteid"]}<br>站名: ${row["SiteName"]}`);
  });

  // 調整地圖視野
  const points = neighbors.map(row => [parseFloat(row["緯度"]), parseFloat(row["經度"])]);
  points.push(centerPoint);
  map.fitBounds(points, { padding: [20, 20] });
}

function PeriodMapData(period = "最近一周") {
  showSpinner();

  fetch(`${APP_ROOT}/5G_low_map/data?period=${encodeURIComponent(period)}`)
    .then(res => res.json())
    .then(data => {
      hideSpinner();
      if (data.error) {
        alert(data.error);
        return;
      }

      document.getElementById("last-updated").textContent = `最後更新：${data.last_modified}`;
      allData = data.data;
      clearMapLayers();

      // 如果使用者已經有輸入 targetSiteid，就自動繪製
      if (targetSiteid) {
        drawMapFromData(allData);
      }
    })
    .catch(err => {
      console.error("資料讀取錯誤:", err);
      alert("讀取資料失敗！");
      hideSpinner();
    });
}

// 查詢 Siteid
function searchBySiteid() {
  const input = document.getElementById("siteid-input");
  if (!input) return alert("找不到輸入欄位 #siteid-input");
  const siteid = input.value.trim();
  if (!siteid) return alert("請輸入 Siteid");
  if (!allData || allData.length === 0) return alert("資料尚未載入完成");

  targetSiteid = siteid;
  drawMapFromData(allData);
}

const legendData = [
  { color: "red", label: "≤ 30%" },
  { color: "blue", label: "30% ~ 70%" },
  { color: "lightgreen", label: "≥ 70%" }
];

const legendDiv = document.getElementById("legend");

legendData.forEach(item => {
  const box = document.createElement("span");
  box.style.display = "inline-block";
  box.style.width = "20px";
  box.style.height = "20px";
  box.style.backgroundColor = item.color;
  box.style.border = "1px solid #aaa";
  box.style.borderRadius = "3px";

  const label = document.createTextNode(item.label);

  legendDiv.appendChild(box);
  legendDiv.appendChild(label);
});

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  PeriodMapData(); // 預設抓最近一周資料
  initReloadButton();

  const searchBtn = document.getElementById("search-btn");
  if (searchBtn) searchBtn.addEventListener("click", searchBySiteid);

    // 取得第一個週期按鈕，假設預設是「最近一周」
  const defaultBtn = document.querySelector(".period-btn[data-period='最近一周']");
  if (defaultBtn) {
    defaultBtn.classList.add("active");
    // 預設載入這個週期
    PeriodMapData(defaultBtn.getAttribute("data-period"));
  }

  document.querySelectorAll(".period-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".period-btn").forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      const period = this.getAttribute("data-period");
      PeriodMapData(period);
      const input = document.getElementById("siteid-input");
      if (input && input.value.trim() !== "") {
        targetSiteid = input.value.trim();
        drawMapFromData(allData);
      }
    });
  });
});

