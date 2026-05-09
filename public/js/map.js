    function updateMarkerVisibility() {
        activeMarkers.forEach(marker => {
            if (isMarkersVisible) {
                if (!map.hasLayer(marker)) marker.addTo(map);
            } else {
                if (map.hasLayer(marker)) map.removeLayer(marker);
            }
        });
    }
    function initMap() {
        map = L.map('map', { 
            center: bounds.all.center, 
            zoom: bounds.all.zoom, 
            zoomControl: false,
            worldCopyJump: true
        });
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        map.on('zoomend', updateKyoshinMarkerSize);
    }

    function activateEarthquake(eq, itemElement) {
        document.querySelectorAll('.eq-item').forEach(el => el.classList.remove('active'));
        if (itemElement) {
            itemElement.classList.add('active');
            itemElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        if (eq.lat && eq.lng) {
            map.flyTo([eq.lat, eq.lng], currentFilter === 'all' ? 6 : 7, { duration: 1.2 });
            drawActiveData(eq); 
        }
    }
    function drawActiveData(eq) {
        if (!eq.lat || !eq.lng) return;
        const epiIcon = L.divIcon({ className: 'epi', html: '<div class="epicenter-cross">X</div>', iconSize: [28, 28], iconAnchor: [14, 14] });
        const badgeIcon = L.divIcon({ className: 'badge', html: `<div class="intensity-badge" style="background:${eq.scaleInfo.color}; margin-top:35px;">M ${eq.mag.toFixed(1)}</div>`, iconSize: [60, 30], iconAnchor: [30, 15] });

        epicenterMarkers.forEach(m => map.removeLayer(m));
        focusBadgeMarkers.forEach(m => map.removeLayer(m));
        
        epicenterMarkers = [];
        focusBadgeMarkers = [];
        
        [-360, 0, 360].forEach(offset => {
            epicenterMarkers.push(L.marker([eq.lat, eq.lng + offset], { icon: epiIcon, zIndexOffset: 2000 }).addTo(map));
            focusBadgeMarkers.push(L.marker([eq.lat, eq.lng + offset], { icon: badgeIcon, zIndexOffset: 2000 }).addTo(map));
        });

        jmaIntensityMarkers.forEach(m => map.removeLayer(m));
        jmaIntensityMarkers = [];

        if (eq.sources.includes('JMA') && eq.points && eq.points.length > 0) {
            const prefMax = {};
            eq.points.forEach(pt => {
                if (pt.scale < 10) return; 
                for (let pref in prefCoords) {
                    if (pt.addr.includes(pref)) {
                        if (!prefMax[pref] || pt.scale > prefMax[pref].scale) prefMax[pref] = pt;
                        break;
                    }
                }
            });

            for (let pref in prefMax) {
                const pt = prefMax[pref];
                const coords = prefCoords[pref];
                const circleColor = getJmaMarkerColor(pt.scale);
                const prefCircleIcon = L.divIcon({
                    className: 'jma-pref-circle',
                    html: `<div style="width:14px; height:14px; background-color:${circleColor}; border-radius:50%; border:1.5px solid #222;"></div>`,
                    iconSize: [14, 14], iconAnchor: [7, 7]
                });
                
                [-360, 0, 360].forEach(offset => {
                    const marker = L.marker([coords[0], coords[1] + offset], { icon: prefCircleIcon, zIndexOffset: 1500 })
                        .bindTooltip(`${pref} (진도 ${getJmaScaleText(pt.scale)})`).addTo(map);
                    jmaIntensityMarkers.push(marker);
                });
            }
        }
    }
