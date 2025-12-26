$(function () {
    var map = L.map('map').setView([x, y], 10);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    var markers = L.markerClusterGroup();
    map.addLayer(markers); 

    var allData = {}; // 存放 3/7/14 天資料

    $.getJSON('/api/complaint', function(data) {
        allData = data;
        drawPoints(allData["3days"]); // 預設顯示最近3天
    });

    function drawPoints(data) {
        markers.clearLayers();
        data.forEach(function (point) {
            var popupHtml = `
                <b>客訴編號:</b> ${point.properties.TICKETNO}<br>
                <b>時間:</b> ${point.properties.EVENT_TIME}<br>
                <b>分類:</b> ${point.properties.TICKET_CLASS}
            `;

            var marker = L.circleMarker([parseFloat(point.lat), parseFloat(point.lon)], {
                color: 'blue',
                radius: 5,
                fillOpacity: 0.2,
                weight: 3
            }).bindPopup(popupHtml);

            markers.addLayer(marker);
        });
    }
    
    // 篩選資料（直接用 days key）
    window.filterByDays = function(days, btn) {
        document.querySelectorAll("button").forEach(function(b) {
            b.classList.remove("active");
        });
        btn.classList.add("active");

        drawPoints(allData[days]); // 直接取對應天數資料
    };
});
