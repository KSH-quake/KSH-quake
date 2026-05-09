    document.getElementById('sound-toggle').addEventListener('click', function() {
        isSoundEnabled = !isSoundEnabled;
        if (isSoundEnabled) {
            this.innerText = '🔔 알림 켜짐';
            this.style.color = '#00C851';
            this.style.borderColor = '#00C851';
            alertSound.play().catch(e => console.log("알림음 활성화 대기"));
        } else {
            this.innerText = '🔕 알림 꺼짐';
            this.style.color = '#888';
            this.style.borderColor = 'var(--border)';
        }
    });
    document.getElementById('marker-toggle').addEventListener('click', function() {
        isMarkersVisible = !isMarkersVisible;
        if (isMarkersVisible) {
            this.innerText = '🔵 마커 켜짐';
            this.style.color = 'var(--accent)';
            this.style.borderColor = 'var(--accent)';
        } else {
            this.innerText = '⚪ 마커 꺼짐';
            this.style.color = '#888';
            this.style.borderColor = 'var(--border)';
        }
        updateMarkerVisibility();
    });
    function switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.content-area').forEach(tab => tab.classList.remove('active'));
        
        if (tabName === 'history') {
            document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
            document.getElementById('history-tab').classList.add('active');
        } else {
            document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
            document.getElementById('sources-tab').classList.add('active');
        }
    }

    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        document.getElementById('clock-text').innerText = `${hours}:${minutes}:${seconds}`;
    }
    setInterval(updateClock, 1000);
    updateClock(); 
    function showToast(eq) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.borderLeftColor = eq.scaleInfo.color;
        
        const magDisplay = eq.mag > 0 ? eq.mag.toFixed(1) : "N/A";
        toast.innerHTML = `
            <div style="font-weight:bold; margin-bottom:6px; color:${eq.scaleInfo.color};">🔔 새로운 지진 정보 (${eq.source})</div>
            <div style="color:#ddd; margin-bottom:4px; font-size:0.95rem;">${eq.place}</div>
            <div style="font-size:0.8rem; color:#aaa;">규모 M${magDisplay} | 깊이 ${eq.depth}km</div>
        `;
        container.appendChild(toast);
        
        setTimeout(() => { if(container.contains(toast)) toast.remove(); }, 5000);
    }
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.getAttribute('data-filter');
            
            document.getElementById('current-filter-label').innerHTML = `🌍 필터 모드 변경: ${e.target.innerText} <span style="font-size: 0.7rem;">▼</span>`;
            
            // 클릭 시 드롭다운 닫기 효과 (클릭하면 바로 숨겨졌다가 복구됨)
            const dropdownContent = document.querySelector('.dropdown-content');
            dropdownContent.style.display = 'none';
            setTimeout(() => dropdownContent.style.display = '', 100);

            lastLatestEqId = null; 
            
            if(bounds[currentFilter]) {
                map.flyTo(bounds[currentFilter].center, bounds[currentFilter].zoom, { duration: 1 });
            }
            
            fetchUnifiedData();
        });
    });
    function renderListAndMap(data, shouldAutoActivateFirst) {
        const listEl = document.getElementById('history-list');
        listEl.innerHTML = '';
        activeMarkers.forEach(m => map.removeLayer(m));
        activeMarkers = [];

        if (data.length === 0) {
            listEl.innerHTML = `<div id="no-data"><strong style="color:#fff;">데이터 없음</strong></div>`;
            return;
        }

        data.forEach((eq, index) => {
            const timeStr = eq.time.toLocaleString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' });
            const sourceBadges = eq.sources.map(src => `<div class="eq-source src-${src.toLowerCase()}">${src}</div>`).join('');
            const magDisplay = eq.mag > 0 ? eq.mag.toFixed(1) : "N/A";
            const depthDisplay = (eq.depth === "-") ? "- km" : `${eq.depth} km`;

            let intensityHtml = "";
            if (eq.sources.includes('JMA') && eq.scaleInfo.intensityText !== "-") {
                intensityHtml = `<div class="metric-box"><div class="metric-label">최대진도</div><div class="metric-val" style="color:${eq.scaleInfo.color};">${eq.scaleInfo.intensityText}</div></div>`;
            }

            const item = document.createElement('div');
            item.className = `eq-item sc-${eq.scaleInfo.class}`;
            item.innerHTML = `
                <div class="eq-header"><div class="eq-place">${eq.place}</div><div class="eq-sources-wrap">${sourceBadges}</div></div>
                <div class="eq-details">
                    <div class="eq-time">${timeStr}</div>
                    <div class="eq-metrics">
                        <div class="metric-box"><div class="metric-label">규모(M)</div><div class="metric-val c-${eq.scaleInfo.class}">${magDisplay}</div></div>
                        <div class="metric-box"><div class="metric-label">깊이</div><div class="metric-val" style="color:#ddd">${depthDisplay}</div></div>
                        ${intensityHtml}
                    </div>
                </div>
            `;
            
            item.onclick = () => activateEarthquake(eq, item);
            listEl.appendChild(item);

            if (eq.lat && eq.lng) {
                const dotIcon = L.divIcon({
                    className: 'intensity-icon',
                    html: `<div style="width:10px; height:10px; background-color:${eq.scaleInfo.color}; border-radius:50%; border:1px solid #fff; opacity:0.8;"></div>`,
                    iconSize: [10, 10], iconAnchor: [5, 5]
                });
                
                [-360, 0, 360].forEach(offset => {
                    const marker = L.marker([eq.lat, eq.lng + offset], { icon: dotIcon });
                    marker.on('click', () => activateEarthquake(eq, item));
                    activeMarkers.push(marker);
                    
                    if (isMarkersVisible) {
                        marker.addTo(map);
                    }
                });
            }

            if(index === 0 && shouldAutoActivateFirst) activateEarthquake(eq, item);
        });
    }
