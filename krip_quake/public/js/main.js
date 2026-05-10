    initMap();
    fetchUnifiedData();
    
    setInterval(fetchUnifiedData, 1000); 

    setInterval(fetchEEWData, 1000);
    fetchEEWData();
