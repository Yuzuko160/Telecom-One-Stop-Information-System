document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("antenna-form");
  const fileInfo = document.getElementById("file-info");
    
  if (!form) {
    console.error("找不到表單元素 #antenna-form");
    return;
  }

  // 你的分類對應表
  const categoryMap = {
    "Ant Info": ["LTE", "NR", "天線型號", "尺寸 (L)", "尺寸 (W)", "尺寸 (D)", "Port", "Array", "Connector", "庫存"],
    "Frequency Band": ["Band-700", "Band-900", "Band-1800", "Band-2100", "Band-2600", "Band-3500"],
    "E-tilt": ["ET-700", "ET-900", "ET-1800", "ET-2100", "ET-2600", "ET-3500"],
    "Gain": ["Gain-700", "Gain-900", "Gain-1800", "Gain-2100", "Gain-2600", "Gain-3500"],
    "Horizontal": ["Horizontal-700", "Horizontal-900", "Horizontal-1800", "Horizontal-2100", "Horizontal-2600", "Horizontal-3500"],
    "Vertical": ["Vertical-700", "Vertical-900", "Vertical-1800", "Vertical-2100", "Vertical-2600", "Vertical-3500"]
  };

  form.addEventListener("submit", function(e) {
    e.preventDefault();
    console.log("表單送出事件觸發");

    const formData = new FormData(form);
    const params = new URLSearchParams(formData);

  fetch(`${APP_ROOT}/ante_query/data?${params.toString()}`)
    .then(response => {
        if (!response.ok) throw new Error("HTTP error " + response.status);
        return response.json();  // ⭐ 這裡一定要轉 JSON
    })
    .then(data => {
        console.log("收到後端資料:", data);

        if (data.last_modified && fileInfo) {
            fileInfo.textContent = data.last_modified;
        }

        const columns = Array.isArray(data.columns) ? data.columns : [];
        const rows = Array.isArray(data.data) ? data.data : [];

        buildTable(columns, rows, categoryMap);
    })
    .catch(err => {
        document.getElementById("result").innerHTML =
          `<p style="color:red;">發生錯誤：${escapeHtml(err.message)}</p>`;
    });
  });
});

// 建表函式
function buildTable(columns, data, categoryMap) {
  const resultDiv = document.getElementById("result");

  // 確保 columns 和 data 是陣列
  columns = Array.isArray(columns) ? columns : [];
  data = Array.isArray(data) ? data : [];

  if (data.length === 0) {
    resultDiv.innerHTML = "<p>查無資料</p>";
    return;
  }

  let html = `<table border="1" cellpadding="5">`;

  // 第一列大標題
  html += "<tr>";
  for (const [category, cols] of Object.entries(categoryMap)) {
    const count = cols.filter(c => columns.includes(c)).length;
    if (count > 0) {
      html += `<th colspan="${count}">${category}</th>`;
    }
  }
  html += "</tr>";

  // 第二列子標題
  html += "<tr>";
  for (const cols of Object.values(categoryMap)) {
    cols.forEach(colName => {
      if (columns.includes(colName)) {
        const numPartMatch = colName.match(/\d+/);
        const display = numPartMatch ? numPartMatch[0] : colName;
        html += `<th>${display}</th>`;
      }
    });
  }
  html += "</tr>";

  // 資料列
  data.forEach(row => {
    html += "<tr>";
    for (const cols of Object.values(categoryMap)) {
      cols.forEach(colName => {
        if (columns.includes(colName)) {
          const cell = row[colName] ?? "";
          html += `<td>${escapeHtml(cell)}</td>`;
        }
      });
    }
    html += "</tr>";
  });

  html += "</table>";

  resultDiv.innerHTML = html;
}

// 防 XSS
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}
