     // 1. 대만 지진계 상태창 UI를 화면에 동적으로 추가
    const ttsStatusBox = document.createElement('div');
    ttsStatusBox.id = 'tts-status-box';
    ttsStatusBox.style.cssText = 'position: absolute; bottom: 80px; left: 420px; z-index: 2000; background: rgba(30, 30, 30, 0.9); color: white; padding: 10px 15px; border-radius: 8px; display: none; font-size: 12px; border: 1px solid #444;';
    ttsStatusBox.innerHTML = '<div style="font-weight: bold; margin-bottom: 3px;">🇹🇼 대만 실시간 모니터링</div><div id="tts-status-text">⏳ 대기 중...</div>';
    document.getElementById('layout').appendChild(ttsStatusBox);
    
    // 2. 대만 지진계용 전역 변수 설정
    let ttsMarkers = {};
    let ttsLayerGroup = L.layerGroup();
    let isTtsLoaded = false;
    let ttsTimeoutId = null;
    let isTtsEnabled = false;

    // 3. 기존 "지진계 끄기/켜기" 버튼에 대만 기능 연동 (이중 리스너 방식)
    document.getElementById('kyoshin-toggle').addEventListener('click', function() {
        // 기존 일본 지진계 이벤트가 버튼 글자를 바꿀 시간을 살짝(50ms) 기다림
        setTimeout(() => {
            isTtsEnabled = this.innerText.includes('켜짐');
            
            if (isTtsEnabled) {
                map.addLayer(ttsLayerGroup);
                ttsStatusBox.style.display = 'block';
                // 최초 1회만 CSV 로드, 이후엔 실시간 통신만 재개
                if (!isTtsLoaded) {
                    loadTTSCSV();
                } else {
                    fetchTTSRealTime();
                }
            } else {
                map.removeLayer(ttsLayerGroup);
                ttsStatusBox.style.display = 'none';
                clearTimeout(ttsTimeoutId); // 통신 중단
            }
        }, 50);
    });

    // 4. 지도 줌(Zoom) 변경 시 대만 마커 크기 조절
    function getDynamicTtsRadius() {
        const zoom = map.getZoom();
        return Math.max(1.0, (zoom * 0.8) - 1.5);
    }

    map.on('zoomend', function() {
        if (isTtsEnabled && isTtsLoaded) {
            const newRadius = getDynamicTtsRadius();
            for (let id in ttsMarkers) {
                ttsMarkers[id].forEach(m => m.setRadius(newRadius));
            }
        }
    });

    // 5. FFF.csv 파싱 및 초기 마커 생성 함수
    function loadTTSCSV() {
        document.getElementById('tts-status-text').innerText = '⏳ FFF.csv 로드 중...';
        fetch('FFF.csv')
            .then(res => res.text())
            .then(csvText => {
                Papa.parse(csvText, {
                    header: true, skipEmptyLines: true,
                    complete: function(results) {
                        let count = 0;
                        results.data.forEach(row => {
                            const lat = parseFloat(row.lat || row.LAT);
                            const lon = parseFloat(row.lon || row.lng || row.LON);
                            const stationId = (row.station || row.STATION || "").trim().toUpperCase();
                            const endAt = String(row.end_at || row.END_AT || "");

                            if (!isNaN(lat) && !isNaN(lon) && stationId && endAt.startsWith('9999')) {
                                const markersForPoint = [];
                                // 무한 스크롤 맵 대응 (-360, 0, 360)
                                [-360, 0, 360].forEach(offset => {
                                    const m = L.circleMarker([lat, lon + offset], {
                                        radius: getDynamicTtsRadius(),
                                        fillColor: "transparent", color: "transparent", weight: 0, fillOpacity: 1.0, interactive: false
                                    });
                                    ttsLayerGroup.addLayer(m);
                                    markersForPoint.push(m);
                                });
                                ttsMarkers[stationId] = markersForPoint;
                                count++;
                            }
                        });
                        
                        if(count > 0) {
                            isTtsLoaded = true;
                            document.getElementById('tts-status-text').innerHTML = `<span style="color:#4CAF50;">✅ ${count}개 관측소 준비됨</span>`;
                            fetchTTSRealTime(); // 파싱 직후 실시간 모니터링 즉시 시작
                        } else {
                            document.getElementById('tts-status-text').innerHTML = `❌ 관측소 데이터가 없습니다.`;
                        }
                    }
                });
            }).catch(() => {
                document.getElementById('tts-status-text').innerHTML = `<span style="color:#f44336;">❌ FFF.csv 로드 실패</span>`;
            });
    }

    // 6. 실시간 대만 PGA 데이터 수신 및 색상 업데이트 함수
    function fetchTTSRealTime() {
        // 버튼이 꺼졌다면 로직 즉시 중단
        if (!isTtsEnabled || !isTtsLoaded) return;
        
        const proxyUrl = "https://small-dust-3884.jaikon-kimi.workers.dev";
        const payload = {
            "query": "query ($recordTime: Float, $type: Int, $token: String) {\n  realtimePGA(recordTime: $recordTime, type: $type, token: $token) {\n    dataVals\n    timestamp\n  }\n}",
            "variables": { "recordTime": 0, "token": "", "type": 0 }
        };

        fetch(proxyUrl, {
            method: 'POST',
            body: JSON.stringify(payload)
        }).then(res => res.json())
          .then(result => {
              let pgaData = result.data.realtimePGA.dataVals;
              if (typeof pgaData === 'string') pgaData = JSON.parse(pgaData);

              document.getElementById('tts-status-text').innerHTML = `<span style="color:#00A4AD;">● 실시간 모니터링 가동 중</span><br>업데이트: ${new Date().toLocaleTimeString()}`;

              for (let raw_id in pgaData) {
                  let station_id = String(raw_id).trim().toUpperCase();
                  if (ttsMarkers[station_id]) {
                      let pga = parseFloat(pgaData[raw_id]);
                      
                      // 대만 전용 PGA 임계값 색상
                      let pickedColor = 'transparent';
                      if (pga >= 0.001)  pickedColor = '#0006D2';//0
                      if (pga >= 0.05)   pickedColor = '#0006D2';
                      if (pga >= 0.1)    pickedColor = '#0006D2';
                      if (pga >= 0.2)    pickedColor = '#0064E1';
                      if (pga >= 0.35)   pickedColor = '#00A4AD';
                      if (pga >= 0.5)    pickedColor = '#00C096';
                      if (pga >= 0.66)   pickedColor = '#99FE16';
                      if (pga >= 0.8)    pickedColor = '#E9FF03';//1
                      if (pga >= 1.0)    pickedColor = '#FCFF00';
                      if (pga >= 1.5)    pickedColor = '#FFF000';
                      if (pga >= 2.5)    pickedColor = '#FFE000';//2
                      if (pga >= 4.0)    pickedColor = '#ffd900';
                      if (pga >= 6.0)    pickedColor = '#ffd900';
                      if (pga >= 8.0)    pickedColor = '#ffa600';//3
                      if (pga >= 11.0)   pickedColor = '#ff9900';
                      if (pga >= 18.0)   pickedColor = '#ff9900';
                      if (pga >= 25.0)   pickedColor = '#ff7300';//4
                      if (pga >= 40.0)   pickedColor = '#ff7300';
                      if (pga >= 75.0)   pickedColor = '#ff4800';
                      if (pga >= 80.0)   pickedColor = '#FC3100';//5-
                      if (pga >= 95.0)   pickedColor = '#FC3100';
                      if (pga >= 120.0)   pickedColor = '#FC3100';
                      if (pga >= 140.0)   pickedColor = '#F60500';//5+
                      if (pga >= 180.0)   pickedColor = '#F60500';
                      if (pga >= 200.0)   pickedColor = '#F60500';
                      if (pga >= 250.0)   pickedColor = '#F60500';//6-
                      if (pga >= 340.0)   pickedColor = '#CD0000';
                      if (pga >= 440.0)   pickedColor = '#CD0000';//6+
                      if (pga >= 600.0)   pickedColor = '#B20000';   
                      if (pga >= 800.0)   pickedColor = '#B20000';//7
                      
                      ttsMarkers[station_id].forEach(marker => {
                          marker.setStyle({ fillColor: pickedColor });
                      });
                  }
              }
          }).catch(err => {
              console.error("대만 지진계 통신 지연:", err);
          }).finally(() => {
              if (isTtsEnabled) {
                  ttsTimeoutId = setTimeout(fetchTTSRealTime, 1500); 
              }
          });
    }