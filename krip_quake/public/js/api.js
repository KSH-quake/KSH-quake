    async function fetchKMA() {
        try {
            const today = new Date();
            const past = new Date();
            past.setDate(today.getDate() - 14); 

            const formatDate = (d) => {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            };

            const startTm = formatDate(past);
            const endTm = formatDate(today);

            const targetUrl = `https://www.weather.go.kr/w/earthquake-volcano/search/korea.do?schOption=&xls=0&startTm=${startTm}&endTm=${endTm}&startSize=&endSize=&startLat=&endLat=&startLon=&endLon=&lat=&lon=&dist=&keyword=&dpType=a`;
            const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`;
            
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error(`프록시 응답 오류: ${res.status}`);
            
            const htmlText = await res.text(); 
            if (!htmlText || htmlText.length < 100) throw new Error("데이터를 가져오지 못했습니다.");
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            const rows = doc.querySelectorAll('table tbody tr');
            
            let itemsArray = [];
            
            rows.forEach(row => {
                const cols = row.querySelectorAll('td');
                if (cols.length >= 8) {
                    const timeRaw = cols[1].textContent || "";
                    const timeStr = timeRaw.trim().replace(/\n/g, ' ').replace(/\s+/g, ' '); 
                    const magStr = (cols[2].textContent || "").trim();
                    const depthStr = (cols[3].textContent || "").trim();
                    const rawIntensityStr = (cols[4].textContent || "").trim();
                    const latStr = (cols[5].textContent || "").replace(/[^0-9.]/g, '');
                    const lngStr = (cols[6].textContent || "").replace(/[^0-9.]/g, '');
                    const placeStr = (cols[7].textContent || "").trim();
                    
                    if(!timeStr || timeStr.includes("발생시각") || timeStr.includes("자료가 없습니다") || timeStr === "") return;
                    
                    const time = new Date(timeStr.replace(/\//g, '-'));
                    if (isNaN(time.getTime())) return;
                    
                    let rawIntensity = null;
                    const romanNumerals = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];
                    romanNumerals.forEach((roman, index) => {
                        if(rawIntensityStr.includes(roman)) rawIntensity = index + 1;
                    });

                    itemsArray.push({
                        id: 'KMA_' + time.getTime(), source: 'KMA',
                        place: placeStr || "위치 알 수 없음", time: time, 
                        lat: parseFloat(latStr), lng: parseFloat(lngStr),
                        mag: parseFloat(magStr) || 0, depth: parseFloat(depthStr) || "-", rawIntensity: rawIntensity
                    });
                }
            });
            return itemsArray;
        } catch (e) { 
            return []; 
        }
    }

    async function fetchJMA() {
        try {
            const res = await fetch('https://api.p2pquake.net/v2/history?codes=551&limit=100');
            const data = await res.json();
            return data.map(eq => ({
                id: 'JMA_' + eq.id, source: 'JMA',
                place: translateRegion(eq.earthquake.hypocenter.name),
                time: new Date(eq.time), lat: eq.earthquake.hypocenter.latitude, lng: eq.earthquake.hypocenter.longitude,
                mag: eq.earthquake.hypocenter.magnitude === -1 ? 0 : eq.earthquake.hypocenter.magnitude, 
                depth: Math.abs(eq.earthquake.hypocenter.depth), rawIntensity: eq.earthquake.maxScale,
                points: eq.points
            }));
        } catch { return []; }
    }

    async function fetchEMSC() {
        try {
            const startDate = getHistoryLimitDateString(14);
            const res = await fetch(`https://www.seismicportal.eu/fdsnws/event/1/query?format=json&start=${startDate}&limit=500`);
            const data = await res.json();
            return data.features.map(f => ({
                id: 'EMSC_' + f.id, source: 'EMSC',
                place: translateRegion(f.properties.flynn_region),
                time: new Date(f.properties.time), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
                mag: f.properties.mag, depth: Math.abs(f.geometry.coordinates[2]), rawIntensity: null
            }));
        } catch { return []; }
    }

    async function fetchUSGS() {
        try {
            const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson');
            const data = await res.json();
            return data.features.map(f => ({
                id: 'USGS_' + f.id, source: 'USGS',
                place: translateRegion(f.properties.place),
                time: new Date(f.properties.time), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
                mag: f.properties.mag, depth: Math.abs(f.geometry.coordinates[2]), rawIntensity: null
            }));
        } catch { return []; }
    }

    async function fetchFDSNWS(url, sourceName, placeDefault) {
        try {
            const res = await fetch(url);
            const data = await res.json();
            return data.features.map(f => {
                let timeStr = f.properties.time;
                if (timeStr && !timeStr.endsWith('Z')) {
                    timeStr += 'Z';
                }
                return {
                    id: sourceName + '_' + f.id, source: sourceName,
                    place: translateRegion(f.properties.place || f.properties.flynn_region || placeDefault),
                    time: new Date(timeStr), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
                    mag: f.properties.mag, depth: Math.abs(f.geometry.coordinates[2]), rawIntensity: null
                };
            });
        } catch { return []; }
    }

    async function fetchINGV() {
        return fetchFDSNWS(`https://webservices.ingv.it/fdsnws/event/1/query?format=geojson&limit=100&orderby=time`, 'INGV', '이탈리아 인근');
    }

    // 브라질(USP) 지진 데이터
    async function fetchUSP() {
        const startDate = getHistoryLimitDateString(14);
        return fetchFDSNWS(`https://moho.iag.usp.br/fdsnws/event/1/query?format=geojson&starttime=${startDate}&limit=100&orderby=time`, 'USP', '브라질 인근');
    }

    async function fetchGeoNet() {
        try {
            const res = await fetch('https://api.geonet.org.nz/quake?MMI=0');
            const data = await res.json();
            return data.features.map(f => ({
                id: 'GEONET_' + f.properties.publicID, source: 'GEONET',
                place: translateRegion(f.properties.locality || "뉴질랜드 인근"),
                time: new Date(f.properties.time), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0],
                mag: f.properties.magnitude, depth: Math.abs(f.properties.depth), rawIntensity: null
            })).slice(0, 100);
        } catch { return []; }
    }

    async function fetchFDSNText(url, sourceName, placeDefault) {
        try {
            const res = await fetch(url);
            const text = await res.text();
            return text.split(/\r?\n/)
                .filter(line => line && !line.startsWith('#'))
                .map(line => {
                    const cols = line.split('|').map(v => v.trim());
                    const time = new Date(cols[1] && !cols[1].endsWith('Z') ? `${cols[1]}Z` : cols[1]);
                    return {
                        id: `${sourceName}_${cols[0]}`, source: sourceName,
                        place: translateRegion(cols[12] || placeDefault),
                        time: time, lat: parseFloat(cols[2]), lng: parseFloat(cols[3]),
                        mag: parseFloat(cols[10]) || 0, depth: Math.abs(parseFloat(cols[4]) || 0), rawIntensity: null
                    };
                })
                .filter(eq => !isNaN(eq.time.getTime()) && !isNaN(eq.lat) && !isNaN(eq.lng));
        } catch { return []; }
    }

    async function fetchGFZ() {
        const startDate = getHistoryLimitDateString(14);
        return fetchFDSNText(`https://geofon.gfz-potsdam.de/fdsnws/event/1/query?format=text&starttime=${startDate}&limit=100&orderby=time`, 'GFZ', 'GFZ region');
    }

    async function fetchUnifiedData() {
        const statusEl = document.getElementById('conn-status');
        
        try {
            // 여러 기관의 최신 지진 데이터를 병렬 수신
            const [jma, emsc, usgs, kma, ingv, usp, geonet, gfz, ga, bgs, phivolcs] = await Promise.all([
                fetchJMA(), fetchEMSC(), fetchUSGS(), fetchKMA(), fetchINGV(), fetchUSP(), fetchGeoNet(), fetchGFZ(), fetchGA(), fetchBGS(), fetchPHIVOLCS()
            ]);
            let rawData = [...jma, ...emsc, ...usgs, ...kma, ...ingv, ...usp, ...geonet, ...gfz, ...ga, ...bgs, ...phivolcs];

            const limitDate = getHistoryLimitDateString(14);
            const limitTime = new Date(limitDate).getTime();

            let normalizedData = rawData.map(eq => {
                const scaleInfo = getUnifiedScale(eq.mag, eq.rawIntensity, eq.source);
                return { ...eq, depth: (typeof eq.depth === 'number') ? eq.depth.toFixed(1) : eq.depth, scaleInfo: scaleInfo };
            }).filter(eq => eq.time.getTime() >= limitTime && eq.place && eq.place.trim() !== "");

            normalizedData.sort((a, b) => b.time - a.time);
            
            let mergedData = mergeEarthquakes(normalizedData);

            if (mergedData.length > 0) {
                const globalLatestId = mergedData[0].id + (mergedData[0].sources ? mergedData[0].sources.join('-') : '');
                
                if (lastGlobalLatestEqId !== null && globalLatestId !== lastGlobalLatestEqId) {
                    const newEq = mergedData[0];
                    let isCurrentFilterMatch = false;

                    if (currentFilter === 'all') {
                        isCurrentFilterMatch = true;
                    } else {
                        // 현재 선택한 기관 필터와 새 지진의 출처 비교
                        const srcMap = { 'korea':'KMA', 'japan':'JMA', 'emsc':'EMSC', 'usgs':'USGS', 'ingv':'INGV', 'usp':'USP', 'geonet':'GEONET', 'gfz':'GFZ', 'ga':'GA', 'bgs':'BGS', 'phivolcs':'PHIVOLCS' };
                        isCurrentFilterMatch = newEq.sources.includes(srcMap[currentFilter]);
                    }

                    if (!isCurrentFilterMatch) {
                        showToast(newEq);
                    }

                    if (isSoundEnabled) {
                        alertSound.currentTime = 0; 
                        alertSound.play().catch(e => console.error("오디오 재생 실패:", e));
                    }
                }
                lastGlobalLatestEqId = globalLatestId;
            }

            let displayData = mergedData;
            if (currentFilter !== 'all') {
                const srcMap = { 'korea':'KMA', 'japan':'JMA', 'emsc':'EMSC', 'usgs':'USGS', 'ingv':'INGV', 'usp':'USP', 'geonet':'GEONET', 'gfz':'GFZ', 'ga':'GA', 'bgs':'BGS', 'phivolcs':'PHIVOLCS' };
                displayData = displayData.filter(eq => eq.sources.includes(srcMap[currentFilter]));
            }
            displayData = displayData.slice(0, 500);

            if (displayData.length > 0) {
                const latestDisplayId = displayData[0].id + (displayData[0].sources ? displayData[0].sources.join('-') : '');
                if (latestDisplayId !== lastLatestEqId) {
                    lastLatestEqId = latestDisplayId;
                    renderListAndMap(displayData, true);
                }
            } else {
                renderListAndMap(displayData, false);
            }
            statusEl.innerHTML = `<span style="color:#00C851;">● 통신 정상 (${new Date().toLocaleTimeString('ko-KR')})</span>`;
        } catch (e) {
            statusEl.innerHTML = `<span style="color:#ff4444;">● 연결 지연</span>`;
        }
    }
     
     
    // 호주(Geoscience Australia) 지진 데이터
    async function fetchGA() {
        try {
            const url = `https://earthquakes.ga.gov.au/geoserver/earthquakes/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=earthquakes:earthquakes_seven_days&outputFormat=application/json&CQL_FILTER=display_flag='Y'&maxFeatures=100&sortBy=origin_time+D`;
            const res = await fetch(url);
            const data = await res.json();
            return data.features.map(f => {
                const props = f.properties || {};
                const coords = f.geometry.coordinates || [];
                return {
                    id: 'GA_' + (props.event_id || f.id), source: 'GA',
                    place: translateRegion(props.description || 'Australia region'),
                    time: new Date(props.origin_time || props.epicentral_time),
                    lat: parseFloat(coords[1]), lng: parseFloat(coords[0]),
                    mag: parseFloat(props.preferred_magnitude ?? props.mw ?? props.mb ?? props.ml ?? props.md) || 0,
                    depth: Math.abs(parseFloat(props.depth) || 0), rawIntensity: null
                };
            });
        } catch { return []; }
    }

    function parsePHIVOLCSDisplayTimePhST(display) {
        const s = display
            .replace(/\uFEFF/g, "")
            .replace(/[\u00A0\u2007\u202F]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const re = /^(\d{1,2})\s+(\w+)\s+(\d{4})\s*[\-–]\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
        const m = s.match(re);
        if (!m) return null;
        const day = parseInt(m[1], 10);
        const monKey = m[2].toLowerCase().replace(/\.$/, "");
        const year = parseInt(m[3], 10);
        let hour = parseInt(m[4], 10);
        const minute = parseInt(m[5], 10);
        const isPm = m[6].toUpperCase() === "PM";
        const MONTHS = {
            jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
            may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
            oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
        };
        const month = MONTHS[monKey];
        if (month === undefined) return null;
        if (isPm && hour < 12) hour += 12;
        if (!isPm && hour === 12) hour = 0;
        return new Date(Date.UTC(year, month, day, hour - 8, minute, 0));
    }

    async function decodeMaybeGzipHtml(buf) {
        const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
        if (u8.length >= 2 && u8[0] === 0x1f && u8[1] === 0x8b) {
            try {
                if (typeof DecompressionStream !== "undefined") {
                    const blob = new Blob([u8]);
                    const ds = new DecompressionStream("gzip");
                    const decompressed = await new Response(blob.stream().pipeThrough(ds)).arrayBuffer();
                    return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(decompressed));
                }
            } catch (_) { /* fall through */ }
        }
        return new TextDecoder("utf-8", { fatal: false }).decode(u8);
    }

    function extractIframeEarthquakeUrlFromWP(html) {
        const m = html.match(/<iframe[^>]+src\s*=\s*["']([^"']*earthquake\.phivolcs[^"']*)["']/i);
        if (!m) return "";
        let src = m[1].trim();
        if (src.startsWith("//")) src = "https:" + src;
        if (!src.startsWith("http"))
            src = "https://www.phivolcs.dost.gov.ph" + (src.startsWith("/") ? src : "/" + src);
        return src.split("#")[0];
    }

    async function fetchTextPHIVOLCSAny(url) {
        const hdrs = new Headers({
            Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9"
        });

        async function fromResponse(res) {
            if (!res || !res.ok) throw new Error("bad");
            return decodeMaybeGzipHtml(await res.arrayBuffer());
        }

        const attempts = [];

        attempts.push(async () => fromResponse(await fetch(url, { headers: hdrs })));

        attempts.push(async () => {
            const u = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
            return fromResponse(await fetch(u));
        });

        attempts.push(async () => {
            const u = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            const r = await fetch(u);
            const j = await r.json();
            if (!j || typeof j.contents !== "string" || j.contents.length < 200) throw new Error("allorigins");
            return j.contents;
        });

        attempts.push(async () => {
            const u = `https://corsproxy.io/?${encodeURIComponent(url)}`;
            return fromResponse(await fetch(u));
        });

        for (const fn of attempts) {
            try {
                const txt = await fn();
                if (
                    txt
                    && txt.length > 400
                    && (/<\s*html/i.test(txt) || /<table/i.test(txt) || /<tr/i.test(txt))
                ) return txt;
            } catch (_) { /* 다음 수단 시도 */ }
        }
        return "";
    }

    function parsePHIVOLCSBulletinHtml(htmlText) {
        const doc = new DOMParser().parseFromString(htmlText, "text/html");
        const rows = doc.querySelectorAll("tr");
        const items = [];
        rows.forEach((tr) => {
            const a =
                tr.querySelector('a[href*="Earthquake_Information"], a[href*="earthquake_information"]')
                || tr.querySelector('a[href*="EQLatest"], a[href*="_Earthquake"]');
            if (!a || !a.getAttribute("href")) return;

            let timeTxt = "";
            const span = a.querySelector("span");
            timeTxt = ((span ? span.textContent : a.textContent) || "").replace(/\s+/g, " ").trim();
            const tds = tr.querySelectorAll("td");
            if (tds.length < 6) return;

            const href = (a.getAttribute("href") || "").replace(/\\/g, "/");

            const lat = parseFloat(tds[1].textContent.replace(/[^\d.\-]/g, "").trim());
            const lng = parseFloat(tds[2].textContent.replace(/[^\d.\-]/g, "").trim());
            if (Number.isNaN(lat) || Number.isNaN(lng)) return;

            const depthStr = tds[3].textContent.trim();
            const magStr = tds[4].textContent.trim();
            const loc = tds[5].textContent.replace(/\s+/g, " ").trim();
            const depthM = depthStr.match(/\d+/);
            const magM = magStr.match(/-?\d+\.?\d*/);

            const time = parsePHIVOLCSDisplayTimePhST(timeTxt);
            if (!time || Number.isNaN(time.getTime())) return;

            const idSlug = (href.split("/").pop() || "x").replace(".html", "");
            items.push({
                id: "PHIVOLCS_" + idSlug,
                source: "PHIVOLCS",
                place: translateRegion(loc),
                time,
                lat,
                lng,
                mag: magM ? parseFloat(magM[0]) : 0,
                depth: depthM ? parseFloat(depthM[0]) : 0,
                rawIntensity: null
            });
        });
        return items;
    }

    async function fetchPHIVOLCS() {
        const bulletinDefault = "https://earthquake.phivolcs.dost.gov.ph/";
        const wpEarthquakePage = "https://www.phivolcs.dost.gov.ph/earthquake-information/";
        try {
            const grabBulletinHtml = async (url) => await fetchTextPHIVOLCSAny(url);

            const parseOrEmpty = async (url) =>
                parsePHIVOLCSBulletinHtml(await grabBulletinHtml(url));

            let rows = await parseOrEmpty(bulletinDefault);
            if (rows.length) return rows;

            const wpHtml = await grabBulletinHtml(wpEarthquakePage);
            if (wpHtml) {
                const iframeUrl = extractIframeEarthquakeUrlFromWP(wpHtml);
                if (
                    iframeUrl
                    && iframeUrl.includes("earthquake.phivolcs")
                    && iframeUrl.replace(/\/$/, "") !== bulletinDefault.replace(/\/$/, "")
                )
                    rows = parsePHIVOLCSBulletinHtml(await grabBulletinHtml(iframeUrl));
                if (!rows.length) rows = parsePHIVOLCSBulletinHtml(wpHtml);
            }

            if (!rows.length) rows = await parseOrEmpty(bulletinDefault);
            return rows;
        } catch {
            return [];
        }
    }

    async function fetchBGS() {
        try {
            const res = await fetch('https://earthquakes.bgs.ac.uk/feeds/MhSeismology.xml');
            const xml = await res.text();
            const doc = new DOMParser().parseFromString(xml, 'text/xml');
            return Array.from(doc.querySelectorAll('item')).map((item, index) => {
                const getText = (tagName) => item.getElementsByTagName(tagName)[0]?.textContent?.trim() || '';
                const getGeoText = (tagName) => (
                    item.getElementsByTagNameNS('http://www.w3.org/2003/01/geo/wgs84_pos#', tagName)[0]?.textContent?.trim()
                    || getText(`geo:${tagName}`)
                    || getText(tagName)
                );
                const description = getText('description');
                const link = getText('link');
                const place = description.match(/Location:\s*([^;]+)/)?.[1]?.trim() || 'United Kingdom region';
                const depth = description.match(/Depth:\s*([0-9.]+)/)?.[1];
                const mag = description.match(/Magnitude:\s*([0-9.]+)/)?.[1] || getText('title').match(/M\s*([0-9.]+)/)?.[1];
                const id = link.split('/').pop()?.replace('.html', '') || index;
                return {
                    id: 'BGS_' + id, source: 'BGS',
                    place: translateRegion(place),
                    time: new Date(`${getText('pubDate')} UTC`),
                    lat: parseFloat(getGeoText('lat')),
                    lng: parseFloat(getGeoText('long')),
                    mag: parseFloat(mag) || 0, depth: Math.abs(parseFloat(depth) || 0), rawIntensity: null
                };
            }).filter(eq => !isNaN(eq.time.getTime()) && !isNaN(eq.lat) && !isNaN(eq.lng));
        } catch { return []; }
    }
