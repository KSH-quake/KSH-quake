     // ============================================
    // 긴급지진속보(EEW) 처리 파트 시작
    // ============================================
    let eewActiveEvent = null;
    let pWaveCircle = null;
    let sWaveCircle = null;
    let eewAnimationId = null;
    
    // 💡 변경점: id만 추적하던 것을 id+reportNum 으로 추적하도록 변경
    let lastEewKey = null; 

    const EEW_APIS = [
        { source: '일본(JMA)', url: 'https://api.wolfx.jp/jma_eew.json' },
        { source: '대만(CWA)', url: 'https://api.wolfx.jp/cwa_eew.json' },
        { source: '중국(SC)', url: 'https://api.wolfx.jp/sc_eew.json' },
        { source: '중국(FJ)', url: 'https://api.wolfx.jp/fj_eew.json' }
    ];

    function parseEEWTime(timeStr, source) {
        if (!timeStr) return new Date();
        let cleanStr = timeStr.replace(/-/g, '/');
        if (!cleanStr.includes('+') && !cleanStr.includes('Z')) {
            if (source.includes('일본')) cleanStr += '+09:00';
            else cleanStr += '+08:00';
        }
        return new Date(cleanStr);
    }

    async function fetchEEWData() {
        let latestActive = null;
        for (const api of EEW_APIS) {
            try {
                // 💡 변경점: URL 끝에 '?t=현재시간'을 붙여 브라우저 캐싱을 완벽히 방지 (항상 최신 N보 수신)
                const fetchUrl = api.url + '?t=' + new Date().getTime();
                const res = await fetch(fetchUrl, { cache: 'no-store' });
                const data = await res.json();
                
                if (data && data.isCancel === false && data.OriginTime) {
                    const originTime = parseEEWTime(data.OriginTime, api.source);
                    const now = new Date();
                    const ageSeconds = (now.getTime() - originTime.getTime()) / 1000;
                    
                    if (ageSeconds >= -10 && ageSeconds < 180) {
                        
                        // 💡 변경점: Mag, Depth 값이 없거나 0일 경우 "분석중" 처리
                        let magVal = parseFloat(data.Mag || data.Magnitude);
                        let depthStr = String(data.Depth || "0").replace(/[^0-9]/g, '');
                        let depthVal = parseInt(depthStr);

                        let parsedMag = (!isNaN(magVal) && magVal > 0) ? `M${magVal.toFixed(1)}` : 'M 분석중';
                        let parsedDepth = (!isNaN(depthVal) && depthVal > 0) ? `${depthVal}km` : '분석중';

                        // 💡 변경점: Wolfx JMA는 발표횟수를 'Serial'로 제공
                        let serialNum = data.Serial || data.ReportNum || data.report_num || "1";

                        latestActive = {
                            id: data.EventID || data.ID || originTime.getTime(),
                            source: api.source,
                            time: originTime,
                            lat: parseFloat(data.Latitude || data.Lat || 0),
                            lng: parseFloat(data.Longitude || data.Lon || 0),
                            mag: parsedMag, 
                            depth: parsedDepth,
                            place: data.Hypocenter || data.Place || "위치 확인 중",
                            reportNum: serialNum,
                            isFinal: data.isFinal || false,
                            maxInt: data.Calcintensity || data.MaxInt || data.MaxIntensity || ""
                        };
                        break; // 가장 최근 활성화된 1개만 찾으면 루프 종료
                    }
                }
            } catch (e) {
                // 패치 에러 발생 시 무시하고 다음 API로 넘어감
            }
        }
        updateEEWUI(latestActive);
    }

    function updateEEWUI(eew) {
        const panel = document.getElementById('eew-panel');
        eewActiveEvent = eew;

        if (!eew) {
            panel.className = '';
            panel.innerHTML = `<div class="eew-title none">발표된 EEW 없음</div>`;
            clearWaves();
            lastEewKey = null;
            return;
        }

        // 💡 변경점: 지진 EventID와 'N보' 숫자를 조합해서 새로운 키 생성
        // 이렇게 하면 1보 -> 2보로 바뀔 때 새로운 정보로 인식해서 소리가 다시 나고 UI가 갱신됩니다.
        const currentEventKey = `${eew.id}-${eew.reportNum}`;

        if (currentEventKey !== lastEewKey) {
            lastEewKey = currentEventKey;
            
            // 알림음 재생 로직 (데이터가 수정/업데이트 될 때마다 재생됨)
            if (typeof isSoundEnabled !== 'undefined' && isSoundEnabled && typeof alertSound !== 'undefined') {
                alertSound.currentTime = 0;
                alertSound.play().catch(e => console.log("알림음 대기"));
            }
        }

        panel.className = 'active';

        // 💡 변경점: N보 배지 표시 로직 개선
        let reportBadge = eew.isFinal ? 
            `<span style="color:#ffeb3b; font-size:0.85rem; margin-left:6px;">[최종보]</span>` : 
            `<span style="color:#aaa; font-size:0.85rem; margin-left:6px;">[제 ${eew.reportNum}보]</span>`;
            
        let intensityText = eew.maxInt ? ` | <strong style="color:#ff8800;">최대진도: ${eew.maxInt}</strong>` : '';

        // 💡 변경점: UI 업데이트 내용
        panel.innerHTML = `
            <div class="eew-title">
                <span>⚠️ 긴급지진속보 (${eew.source}) ${reportBadge}</span>
                <span class="eew-tag">발령중</span>
            </div>
            <div class="eew-info">
                <strong>진앙:</strong> ${eew.place}<br>
                <strong>규모:</strong> ${eew.mag} | <strong>깊이:</strong> ${eew.depth}${intensityText}<br>
                <strong>발생시각:</strong> ${eew.time.toLocaleTimeString('ko-KR')}
            </div>
            <div class="eew-legend">
                <span style="color:#4dabf7; margin-right: 10px;">🔵 P파 도달 예상</span>
                <span style="color:#ff4444;">🔴 S파 도달 예상</span>
            </div>
        `;

        if (!pWaveCircle) {
            pWaveCircle = L.circle([eew.lat, eew.lng], {
                color: '#4dabf7', fillColor: 'transparent', weight: 2, dashArray: '5, 5', interactive: false
            }).addTo(map);
        }
        if (!sWaveCircle) {
            sWaveCircle = L.circle([eew.lat, eew.lng], {
                color: '#ff4444', fillColor: 'rgba(255, 68, 68, 0.15)', weight: 3, interactive: false
            }).addTo(map);
        }

        pWaveCircle.setLatLng([eew.lat, eew.lng]);
        sWaveCircle.setLatLng([eew.lat, eew.lng]);

        if (!eewAnimationId) {
            animateWaves();
        }
    }

    function animateWaves() {
        if (!eewActiveEvent) {
            clearWaves();
            return;
        }

        const now = new Date();
        const ageSec = (now.getTime() - eewActiveEvent.time.getTime()) / 1000;

        if (ageSec > 0) {
            const pRadius = ageSec * 6.5 * 1000; 
            const sRadius = ageSec * 3.5 * 1000;

            if (pWaveCircle) pWaveCircle.setRadius(pRadius);
            if (sWaveCircle) sWaveCircle.setRadius(sRadius);
        }

        eewAnimationId = requestAnimationFrame(animateWaves);
    }

    function clearWaves() {
        if (pWaveCircle) { map.removeLayer(pWaveCircle); pWaveCircle = null; }
        if (sWaveCircle) { map.removeLayer(sWaveCircle); sWaveCircle = null; }
        if (eewAnimationId) { cancelAnimationFrame(eewAnimationId); eewAnimationId = null; }
    }
    // ============================================
    // 긴급지진속보 처리 파트 끝
    // ============================================
