    function getHistoryLimitDateString(days = 14) {
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d.toISOString().split('T')[0];
    }

    // 100% 수동 번역 사전
    function translateRegion(text) {
        if (!text) return "";
        let koText = text;

        const dirMap = {
            "N": "북쪽", "S": "남쪽", "E": "동쪽", "W": "서쪽", "NE": "북동쪽", "NW": "북서쪽", "SE": "남동쪽", "SW": "남서쪽",
            "NNE": "북북동쪽", "NNW": "북북서쪽", "SSE": "남남동쪽", "SSW": "남남서쪽", "ENE": "동북동쪽", "WNW": "서북서쪽", "ESE": "동남동쪽", "WSW": "서남서쪽"
        };
        
        koText = koText.replace(/(\d+(?:\.\d+)?) km ([A-Z]{1,3}) of (.*)/i, (match, dist, dir, place) => {
            const koDir = dirMap[dir.toUpperCase()] || dir; return `${place} 기준 ${koDir} ${dist}km 해역/지점`;
        });
        
        const dictionary = {
            "south korea": "대한민국", "north korea": "북한", "taiwan region": "대만", "taiwan": "대만", "japan": "일본", 
            "china": "중국", "russia": "러시아", "philippines": "필리핀", "indonesia": "인도네시아", "united states": "미국", 
            "alaska": "알래스카", "hawaii": "하와이", "california": "캘리포니아", "texas": "텍사스", "nevada": "네바다",
            "chile": "칠레", "mexico": "멕시코", "peru": "페루", "argentina": "아르헨티나", "colombia": "콜롬비아",
            "new zealand": "뉴질랜드", "australia": "호주", "papua new guinea": "파푸아뉴기니", "fiji": "피지", "vanuatu": "바누아투",
            "turkey": "튀르키예", "greece": "그리스", "italy": "이탈리아", "france": "프랑스", "spain": "스페인", "iran": "이란",
            "india": "인도", "pakistan": "파키스탄", "afghanistan": "아프가니스탄", "nepal": "네팔", "myanmar": "미얀마",
            
            "kermadec islands": "케르마데크 제도", "kermadec": "케르마데크", "kuril islands": "쿠릴 열도", "aleutian islands": "알류샨 열도",
            "marianas": "마리아나 제도", "mariana islands": "마리아나 제도", "solomon islands": "솔로몬 제도", "tonga": "통가",
            "pacific ocean": "태평양", "atlantic ocean": "대서양", "indian ocean": "인도양", "mediterranean sea": "지중해",
            "sea of japan": "동해", "philippine sea": "필리핀해", "caribbean sea": "카리브해", "bering sea": "베링해",
            "sea of okhotsk": "오호츠크해", "gulf of alaska": "알래스카만", "gulf of mexico": "멕시코만", "arabian sea": "아라비아해",
            
            "北海道":"홋카이도", "青森県":"아오모리현", "岩手県":"이와테현", "宮城県":"미야기현", "秋田県":"아키타현", "山形県":"야마가타현", "福島県":"후쿠시마현",
            "茨城県":"이바라키현", "栃木県":"도치기현", "群馬県":"군마현", "埼玉県":"사이타마현", "千葉県":"지바현", "東京都":"도쿄도", "神奈川県":"가나가와현",
            "新潟県":"니가타현", "富山県":"도야마현", "石川県":"이시카와현", "福井県":"후쿠이현", "山梨県":"야마나시현", "長野県":"나가노현", "岐阜県":"기후현",
            "静岡県":"시즈오카현", "愛知県":"아이치현", "三重県":"미에현", "滋賀県":"시가현", "京都府":"교토부", "大阪府":"오사카부", "兵庫県":"효고현",
            "奈良県":"나라현", "和歌山県":"와카야마현", "鳥取県":"돗토리현", "島根県":"시마네현", "岡山県":"오카야마현", "広島県":"히로시마현", "山口県":"야마구치현",
            "徳島県":"도쿠시마현", "香川県":"가가와현", "愛媛県":"에히메현", "高知県":"고치현", "福岡県":"후쿠오카현", "佐賀県":"사가현", "長崎県":"나가사키현",
            "熊本県":"구마모토현", "大分県":"오이타현", "宮崎県":"미야자키현", "鹿児島県":"가고시마현", "沖縄県":"오키나와현",
            
            "津軽": "쓰가루", "宗谷": "소야", "釧路": "구시로", "阿蘇": "아소", "三陸": "산리쿠", "三八上北": "산파치 카미키타", 
            "日向灘": "휴가나다", "与那国島": "요나구니섬", "沖縄本島": "오키나와 본섬", "縄本島": "오키나와 본섬",
            "網走": "아바시리", "根室": "네무로", "胆振": "이부리", "日高": "히다카", "十勝": "도카치", "留萌": "루모이", 
            "石狩": "이시카리", "空知": "소라치", "後志": "시리베시", "渡島": "오시마", "檜山": "히야마", "上川": "가미카와", 
            "下北": "시모키타", "伊豆大島": "이즈오시마", "伊豆半島": "이즈반도", "能登半島": "노토반도", "薩摩半島": "사쓰마반도", 
            "大隅半島": "오스미반도", "紀伊水道": "기이스이도", "豊後水道": "분고스이도", "奄美大島": "아마미오시마", 
            "トカラ列島": "도카라 열도", "千島列島": "쿠릴 열도", "小笠原諸島": "오가사와라 제도", "八丈島": "하치조지마", 
            "父島": "치치지마", "硫黄島": "이오지마", "瀬戸内海": "세토내해",
            
            "hokkaido": "홋카이도", "honshu": "혼슈", "kyushu": "규슈", "shikoku": "시코쿠", "ryukyu islands": "류큐 열도",
            
            "台湾": "대만", "臺灣": "대만", "台湾海峡": "대만 해협", "台湾以东海域": "대만 동부 해역", "台湾附近海域": "대만 부근 해역",
            
            "内陸北部": " 내륙 북부", "内陸南部": " 내륙 남부", "内陸東部": " 내륙 동부", "内陸西部": " 내륙 서부",
            "北西部": " 북서부", "南西部": " 남서부", "北東部": " 북동부", "南東部": " 남동부",
            "北部": " 북부", "南部": " 남부", "東部": " 동부", "西部": " 서부", "中部": " 중부", "内陸": " 내륙",
            "与那国島近海": "요나구니섬 근해", "沖縄本島近海": "오키나와 본섬 근해", "台湾付近": "대만 부근",
            
            "off the coast of": "앞바다", "near the coast of": "해안 인근", "coast of": "해안", "near east": "동부 근해", "near": "인근",
            "south of": "남부", "north of": "북부", "east of": "동부", "west of": "서부", "central": "중부", "region": "지역",
            "islands": "제도", "island": "섬", "peninsula": "반도", "strait": "해협", "bay": "만", "gulf": "만",
            "northern": "북부", "southern": "남부", "eastern": "동부", "western": "서부",
            
            "近海": " 근해", "付近": " 부근", "周辺": " 주변",
            "沖": " 앞바다", "湾": " 만", "海峡": " 해협", "地方": " 지방", "半島": " 반도", "列島": " 열도"
        };

        const sortedKeys = Object.keys(dictionary).sort((a, b) => b.length - a.length);
        
        for (let key of sortedKeys) {
            koText = koText.replace(new RegExp(key, "ig"), dictionary[key]);
        }
        
        return koText.replace(/\s+/g, ' ').trim();
    }

    function getUnifiedScale(mag, intensityVal, source) {
        let levelClass = 1; let color = "#33b5e5";
        const scaleRef = mag;

        if (scaleRef >= 7.0) { levelClass = 7; color = "#880000"; }
        else if (scaleRef >= 6.0) { levelClass = 6; color = "#CC0000"; }
        else if (scaleRef >= 5.0) { levelClass = 5; color = "#ff4444"; }
        else if (scaleRef >= 4.0) { levelClass = 4; color = "#ff8800"; }
        else if (scaleRef >= 3.0) { levelClass = 3; color = "#ffbb33"; }
        else if (scaleRef >= 2.0) { levelClass = 2; color = "#00C851"; }

        let intensityText = "-";
        if (source === 'JMA' && intensityVal) {
            if (intensityVal >= 70) intensityText = "7"; else if (intensityVal >= 60) intensityText = "6강";
            else if (intensityVal >= 50) intensityText = "5강"; else if (intensityVal >= 40) intensityText = "4";
            else if (intensityVal >= 30) intensityText = "3"; else if (intensityVal >= 20) intensityText = "2";
            else if (intensityVal >= 10) intensityText = "1"; else intensityText = "0";
        }
        return { class: levelClass, color: color, intensityText: intensityText };
    }

    function getJmaMarkerColor(scale) {
        if (scale >= 70) return "#880e4f"; if (scale >= 60) return "#b71c1c";
        if (scale >= 55) return "#ff3d00"; if (scale >= 50) return "#ff9800";
        if (scale >= 45) return "#ffeb3b"; if (scale >= 40) return "#ffe082";
        if (scale >= 30) return "#0000ff"; if (scale >= 20) return "#03a9f4";
        if (scale >= 10) return "#ffffff"; return "transparent";
    }

    function getJmaScaleText(scale) {
        if (scale >= 70) return "7"; if (scale >= 60) return "6강"; if (scale >= 55) return "6약";
        if (scale >= 50) return "5강"; if (scale >= 45) return "5약"; if (scale >= 40) return "4";
        if (scale >= 30) return "3"; if (scale >= 20) return "2"; if (scale >= 10) return "1";
        return "0";
    }

    function mergeEarthquakes(data) {
        const merged = [];
        const TIME_THRESHOLD = 3 * 60 * 1000;
        const DIST_THRESHOLD = 1.5;

        data.forEach(eq => {
            let isMerged = false;
            for (let i = 0; i < merged.length; i++) {
                const mEq = merged[i];
                const timeDiff = Math.abs(eq.time.getTime() - mEq.time.getTime());
                const latDiff = Math.abs(eq.lat - mEq.lat);
                const lngDiff = Math.abs(eq.lng - mEq.lng);

                if (timeDiff <= TIME_THRESHOLD && latDiff <= DIST_THRESHOLD && lngDiff <= DIST_THRESHOLD) {
                    if (!mEq.sources.includes(eq.source)) mEq.sources.push(eq.source);
                    if (eq.points && !mEq.points) mEq.points = eq.points;
                    isMerged = true;
                    break;
                }
            }
            if (!isMerged) {
                eq.sources = [eq.source];
                merged.push(eq);
            }
        });
        return merged;
    }
