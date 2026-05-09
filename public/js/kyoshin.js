    // ============================================
    // 실시간 지진계 (Kyoshin) 처리 파트 시작
    // ============================================
    let isKyoshinEnabled = false;
    let kyoshinMarkers = [];
    let kyoshinLayerGroup = L.layerGroup();
    let kyoshinIntervalId = null;
    let isKyoshinLoaded = false;

    const kyoshinColorMap = {
        'a': '#0006D2', 'b': '#0006D2', 'c': '#0006D2', 'd': '#0006D2', 
        'e': '#003FF4', 'f': '#0064E1', 'g': '#0064E1', 'h': '#00A4AD', 
        'i': '#17DF69', 'j': '#17DF69', 'k': '#50FB2F', 
        'l': '#99FE16', 'm': '#C2FF0B', 'n': '#E9FF03', 
        'o': '#FCFF00', 'p': '#FFF000', 'q': '#FFE000', 
        'r': '#FFC700', 's': '#FFC700', 't': '#FFAA00', 
        'u': '#FF6500', 'v': '#FC3100', 'w': '#FC3100', 
        'x': '#F60500', 'y': '#CD0000', 'z': '#B20000'  
    };

    function updateKyoshinMarkerSize() {
        if (!isKyoshinEnabled || !isKyoshinLoaded) return;
        const zoom = map.getZoom();
        
        // 이전보다 조금 더 작게 (기본 1.0 최소값, 비율 완만화)
        let dynamicRadius = Math.max(1.0, (zoom * 0.8) - 1.5);
        
        kyoshinMarkers.forEach(markersForPoint => {
            markersForPoint.forEach(marker => {
                marker.setRadius(dynamicRadius);
            });
        });
    }

    async function loadKyoshinData() {
        try {
            const response = await fetch('data/ddd.json');
            if (!response.ok) throw new Error("ddd.json 로드 실패");
            const data = await response.json();
            
            data.items.forEach(coord => {
                const markersForPoint = [];
                
                [-360, 0, 360].forEach(offset => {
                    const marker = L.circleMarker([coord[0], coord[1] + offset], {
                        radius: 3,         
                        fillColor: "transparent",
                        color: "transparent",
                        weight: 0,
                        fillOpacity: 1.0,
                        interactive: false
                    });
                    markersForPoint.push(marker);
                    kyoshinLayerGroup.addLayer(marker);
                });
                
                kyoshinMarkers.push(markersForPoint); 
            });
            isKyoshinLoaded = true;
            updateKyoshinMarkerSize(); 
            fetchRealTimeKyoshin(); 
        } catch (error) {
            console.error(error);
            alert("지진계 기능을 위한 'ddd.json' 파일을 찾을 수 없습니다.");
            document.getElementById('kyoshin-toggle').click(); 
        }
    }

    async function fetchRealTimeKyoshin() {
        if (!isKyoshinEnabled || !isKyoshinLoaded) return;

        const now = new Date();
        now.setSeconds(now.getSeconds() - 3); 
        
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');

        const url = `https://weather-kyoshin.east.edge.storage-yahoo.jp/RealTimeData/${y}${m}${d}/${y}${m}${d}${hh}${mm}${ss}.json`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error();
            
            const data = await response.json();
            const intensityStr = data.realTimeData.intensity || ""; 

            for (let i = 0; i < intensityStr.length; i++) {
                if (kyoshinMarkers[i]) {
                    const char = intensityStr[i];
                    const pickedColor = kyoshinColorMap[char] || "transparent";

                    kyoshinMarkers[i].forEach(marker => {
                        marker.setStyle({ fillColor: pickedColor });
                    });
                }
            }
        } catch (e) {}
    }

    document.getElementById('kyoshin-toggle').addEventListener('click', function() {
        isKyoshinEnabled = !isKyoshinEnabled;
        if (isKyoshinEnabled) {
            this.innerText = '📡 지진계 켜짐';
            this.style.color = '#17DF69';
            this.style.borderColor = '#17DF69';

            map.addLayer(kyoshinLayerGroup);

            if (!isKyoshinLoaded) {
                loadKyoshinData();
            } else {
                updateKyoshinMarkerSize();
                fetchRealTimeKyoshin();
            }
            kyoshinIntervalId = setInterval(fetchRealTimeKyoshin, 1000); 
        } else {
            this.innerText = '📡 지진계 꺼짐';
            this.style.color = '#888';
            this.style.borderColor = 'var(--border)';

            map.removeLayer(kyoshinLayerGroup);
            clearInterval(kyoshinIntervalId);
        }
    });
    // ============================================
    // 실시간 지진계 처리 파트 끝
    // ============================================
