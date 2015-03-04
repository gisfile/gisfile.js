L.gis = function(t, e) {
    return new L.Gis(t, e);
}

L.Gis = L.Map.extend({
    layer: function( n, o) {
        var l = new L.GisFile.Layer( n, o);
        this.addLayer(l);
        return l;
    },
    map: function( n, o) {
        var l = new L.GisFile.Map( n, o);
        this.addLayer(l);
        return l;
    }
});

L.GisFile = L.Class.extend(
{
    options: {
        url: 'http://gisfile.com/'
    },  

    initialize: function ( options) 
    {
        L.setOptions(this, options);
    },    

    highlightFeature: function(e) 
    {
        var layer = e.target;

        if (e.layer || e._layers)
        {
            layer.setStyle({
                weight: 1,
                color: '#666',
                dashArray: '',
                fillOpacity: 0.7
            });

            if (!L.Browser.ie && !L.Browser.opera) {
                layer.bringToFront();
            }
        }
    },

    resetHighlight: function(e) 
    {
        var layer = e.target;

        if (e.layer || e._layers)
        {
            layer.setStyle({
                weight: 1,
                color: '#FFF',
                dashArray: '',
                fillOpacity: 0.7
            });                            
        }
    },
    
    zoomToFeature: function(e) {
        this._map.fitBounds(e.target.getBounds());
    },

    getAjax: function(url, async, cb) 
    {
        if (window.XMLHttpRequest === undefined) 
        {
            window.XMLHttpRequest = function() {
                try {
                    return new ActiveXObject("Microsoft.XMLHTTP.6.0");
                }
                catch (e1) {
                    try {
                        return new ActiveXObject("Microsoft.XMLHTTP.3.0");
                    }
                    catch (e2) {
                        throw new Error("XMLHttpRequest is not supported");
                    }
                }
            };
        }

        var request = new XMLHttpRequest();
        request.open('GET', url, async);

        request.onreadystatechange = function() 
        {
            var response = {};
            if (request.readyState === 4 && request.status === 200) {
                try {
                    if(window.JSON) {
                        response = JSON.parse(request.responseText);
                    } else {
                        response = eval("("+ request.responseText + ")");
                    }
                } catch(err) {
                    console.info(err);
                    response = {};
                }
                cb(response);
            }
        };

        request.send();
        return request;   
    }
});

L.GisFile.Layer = L.GisFile.extend(
{
    initialize: function(n, options) 
    {
        var that = this;
        var o = L.setOptions(this, options);
        o.layer = n;

        var now = new Date();
        var str = '&datetime=' +now.getDate() + "/"+(now.getMonth()+1) + "/" +now.getFullYear() + " " +
                    now.getHours() + ":" +now.getMinutes() + ":" +now.getSeconds();
                    
        this._url = o.url;
        this._urj = o.url +'api/' +o.layer +'/json';
        this._urf = o.url +'api?json=fields&layer=' +o.layer +str;
        
        if (o.marker) 
            this.markers = L.markerClusterGroup();
        
        if (o.icon) 
        {
            var u = o.icon;

            if (u.length == 0) {
                u = 'marker-icon';
            }

            if (u.length > 0) 
            {
                if (u.indexOf( "/") == -1)
                    u = o.url +"css/icons/" +u;

                if (o.icon.indexOf( ".") == -1)
                    u = u +".png";

                var img = new Image();
                img.onload = function() {
                    that._icon = L.icon({ iconUrl: u, iconSize: [this.width, this.height], iconAnchor: [this.width/2 -1, +this.height -1], popupAnchor: [0, -this.height +5]});
                }
                img.src = u;
            }
        }
    },

    onAdd: function(map) 
    {
        var that = this;
        this._map = map;

        if (this.options.marker) 
            map.addLayer(this.markers); 

        this.getAjax( this._urj, true, function(data) {
            var layer = L.geoJson( data, { that: that, style: that.getStyle, onEachFeature: that.onEachFeature});
            
            if (!that.options.marker) 
                layer.addTo(map);
        });
        
        this.getAjax( this._urf, true, function(data) {
            that.fields = data;
        })
    },
    
    getStyle: function(feature) 
    {
        function getColor(d) 
        {
            return d > 1000 ? '#800026' :
                   d > 500  ? '#BD0026' :
                   d > 200  ? '#E31A1C' :
                   d > 100  ? '#FC4E2A' :
                   d > 50   ? '#FD8D3C' :
                   d > 20   ? '#FEB24C' :
                   d > 10   ? '#FED976' :
                              '#FFEDA0';
        }
    
        var fillcolor = getColor(feature.id);
        return {
            fillColor: fillcolor,
            weight: 1,
            opacity: 1,
            color: 'white',
            dashArray: '',
            fillOpacity: 0.7
        };
    },

    onEachFeature: function(feature, layer) 
    {
        var that = this.that;
        var items = that.getItems( that, feature.properties); //feature.properties;
        var popupContent = "<div class='modal-body' style='width: 287px'>" +
                           "<p>" +items.join( "") +"</p>" +
                           "</div>";

        if (feature.properties && feature.properties.popupContent) {
            layer.bindPopup( feature.properties.popupContent);
        }

        layer.bindPopup(popupContent);
        
        if (that._icon) 
        {
            if (layer._layers)
               layer._layers[ layer._leaflet_id -1].setIcon( that._icon);
            else
               layer.setIcon( that._icon);
        }                        
        
        layer.on({
            mouseover: this.that.highlightFeature,
            mouseout: this.that.resetHighlight
        });                            
        
        if (that.options.marker)
            that.markers.addLayer(layer);
    },
    
    getItems: function(that, data) 
    {
        var items = [];
        for (var key in data) {
            var val = data[ key];
            items.push( "<h4>" +that.getFieldTitle( key) +"</h4>" +val + "<br>" );
        };  

        return items;
    },
    
    getFieldTitle: function(name)
    {
        var fields = this.fields;
        
        if (fields && fields.fields)
        {
            for (var rows in fields.fields) 
            { 
                var row = fields.fields[ rows];
                if (row[ 0]) {
                    var field = row[ 0];

                    if (field.name && field.title && field.name.toLowerCase() == name.toLowerCase()) {
                       return field.title;
                    }
                }
            }
        }  
                        
        return name;
    }
});

L.GisFile.Map = L.GisFile.extend(
{
    initialize: function(n, options) 
    {
        var o = L.setOptions(this, options);
        o.map = n;
        
        this._url = o.url;
        this._urp = o.url +'map/' +o.map +'/json';
        
        this.defaultIcon = L.Icon.Default.extend({ options: { iconUrl: o.url +'css/icons/marker-icon.png' } });
        this.layerIcon = new this.defaultIcon();
    },

    onAdd: function(map) 
    {
        var that = this;
        var o = that.options;
        that._map = map;
        that.baseMaps = {}; //{'OpenSreetMap': that.options.osm};
        that.overlayMaps = {};
        that.geojsonLayers = [];

        this.getAjax( this._urp, true, function(data) 
        {
            var layers = data;
            var setview = (o.setview != undefined ? o.setview : true);
            var setviewf = false;
            var i = 1000;
            var baseMaps = that.baseMaps;
            var overlayMaps = that.overlayMaps;
            var geojsonLayers = that.geojsonLayers;
            
            for (var layer in layers) 
            {
                if (layers[ layer].style) 
                {
                    if (setview && layers[ layer].style.lat && layers[ layer].style.lng && layers[ layer].style.zoom) {
                        map.setView([layers[ layer].style.lat, layers[ layer].style.lng], layers[ layer].style.zoom);
                        setviewf = true;
                    }
                }

                if (layers[ layer].show && Boolean( layers[ layer].show) == true) 
                {
                    // Tiles layer

                    if (layers[ layer].type && (layers[ layer].type.indexOf("TileLayer") >= 0 || layers[ layer].type.indexOf("TileImage") >= 0)) 
                    {                            
                        if (layers[ layer].layer) 
                        {
                            if (layers[ layer].type == "TileImage" && layers[ layer].url) {
                                geojsonLayers[ layer] = new L.TileLayer( layers[ layer].url);
                                geojsonLayers[ layer].setOpacity( 0.5);
                            }

                            if (layers[ layer].type == "TileLayer" && layers[ layer].url)
                                geojsonLayers[ layer] = new L.TileLayer( layers[ layer].url);

                            if (layers[ layer].type == "TileLayerGoogle")
                                geojsonLayers[ layer] = new L.Google( layers[ layer].subType);

                            if (layers[ layer].type == "TileLayerYandex")
                                geojsonLayers[ layer] = new L.Yandex( layers[ layer].subType);

                            geojsonLayers[ layer].addTo( map);

                            var lName = layers[ layer].layer;

                            if (layers[ layer].name)
                                lName = layers[ layer].name;

                            overlayMaps[ lName] = geojsonLayers[ layer];
                        }
                    }

                    // Objects Layer

                    if (!layers[ layer].type || layers[ layer].type.indexOf("Overlay") >= 0) 
                    {                            
                        if (layers[ layer].layer) 
                        {
                            geojsonLayers[ layer] = new L.geoJson();
                            //geojsonLayers[ layer].on( 'layer', function(e){ console.log( e)});
                            var filter = '';

                            if (layers[ layer].filter)
                                filter = JSON.stringify( layers[ layer].filter,null,null);

                            that.getTabJson( that._url +'api?json=fields&layer=' +layers[ layer].layer, layers[ layer], that);
                            that.getGisJson( that._url +'layer/' +layers[ layer].layer +'/json', filter, geojsonLayers[ layer], layers[ layer], that);
                            
                            geojsonLayers[ layer].addTo( map);
                            var lName = layers[ layer].layer;

                            if (layers[ layer].name)
                                lName = layers[ layer].name;

                            //lName = '<a href="' +that._url +'layer/' +layers[ layer].layer +'/editor" target="_blank" title="Р РµРґР°РєС‚РѕСЂ"><img src="' +that._url +'img/map_edit.png"></a> ' +lName;
                            //lName = '<a href="' +that._url +'layer/' +layers[ layer].layer +'/html" target="_blank" title="Р’СЊСЋРІРµСЂ"><img src="' +that._url +'img/map_view.png"></a> ' +lName;

                            overlayMaps[ lName] = geojsonLayers[ layer];
                        }
                    }
                }
            }
            
            that._control = new L.Control.Layers( baseMaps, overlayMaps, {autoZIndex: false});
            map.addControl( that._control); //.addTo( map);
            
            map.on('overlayadd', function(e){ that.updateMapList(e)});
        });
    },
    
    updateMapList: function( e) 
    {
        var that = this;
        var map = this._map;
        var overlayMaps = this.overlayMaps;
        
        try {
            map.off('overlayadd');
            
            for (var layer in overlayMaps) 
            {
                if (map.hasLayer( overlayMaps[ layer]) && overlayMaps[ layer]._map != null) {
                    map.removeLayer( overlayMaps[ layer]);
                    map.addLayer( overlayMaps[ layer]);
                }
            }
        } finally {
            map.on('overlayadd', function(e){ that.updateMapList(e)});
        }
    },
    
    getGisJson: function(url, filter, layer, param, that)
    {
        this.getAjax( url +'?filter=' +filter, true, function(data) 
        {       
            var layerStyle = param.styles;
            //var layerFields = param.fields;

            if (param.style && param.style.icon && param.style.icon.url)
            {
                if (param.style.icon.width && param.style.icon.height) {
                    that.setIcon( that._url +param.style.icon.url, param.style.icon.width, param.style.icon.height);
                } else {
                    that.setIcon( that._url +param.style.icon.url, 36, 36);
                }

                var img = new Image();
                img.onload = function() {
                    that.setIcon( that._url +param.style.icon.url, img.width, img.height);
                }
                img.src = that._url +param.style.icon.url;

            } else {
               that.layerIcon = new that.defaultIcon();
            }

            var jLayer = L.geoJson( data, { param: param, that: that, style: function(f) {return that.style(f, that, param.styles)}, onEachFeature: that.onEachFeature }).addTo(layer);

            if (param && param.style)
            {
                if (param.style.weight)
                    jLayer.setStyle({weight: param.style.weight});

                if (param.style.color)
                    jLayer.setStyle({color: that.valColor( param.style.color)});

                if (!layerStyle && param.style.fillColor) {
                    if (param.style.fillColor == "none")
                        jLayer.setStyle({fillColor: param.style.fillColor});
                    else
                        jLayer.setStyle({fillColor: that.valColor( param.style.fillColor)});
                }

                if (param.style.fillOpacity)
                    jLayer.setStyle({fillOpacity: param.style.fillOpacity});
            }
            
            that.updateMapList();
        });
    },

    getTabJson: function(url, param, that)
    { 
        this.getAjax( url, true, function(data) {       
            param.fields = data;
        });
    },
    
    getFieldTitle: function(name)
    {
        var fields = this.fields;
        
        if (fields && fields.fields)
        {
            for (var rows in fields.fields) 
            { 
                var row = fields.fields[ rows];
                if (row[ 0]) {
                    var field = row[ 0];

                    if (field.name && field.title && field.name.toLowerCase() == name.toLowerCase()) {
                       return field.title;
                    }
                }
            }
        }  
                        
        return name;
    },     
    
    getItems: function(that, data) 
    {
        var items = [];
        for (var key in data) {
            var val = data[ key];
            items.push( "<h4>" +that.getFieldTitle( key) +"</h4>" +val + "<br>" );
        };  

        return items;
    },
            
    iconCount: function( childCount, color) 
    {
        var c = ' marker-cluster-';
        
        if (childCount < 10) {
            c += 'small';
        } else if (childCount < 100) {
            c += 'medium';
        } else {
            c += 'large';
        }

        return new L.DivIcon({ html: '<button style="background-color:' +color +';width:40px;height:40px;border-radius:20px;"><div style="margin: 0px;background-color:' +color +'"><span>' + childCount + '</span></div></button>', className: 'thrumbal', iconSize: new L.Point(40, 40) });
    },
    
    getStyle: function(val, layerStyle) 
    {
        //var that = this;
        var prior = undefined; 

        if (layerStyle)
        for (var iStyle in layerStyle.style) 
        {
            var style = layerStyle.style[ iStyle];
            var value = "" +style.value;

            if (value.length > 0 && value.indexOf("-", 1) > 0 && layerStyle.type != 'string')
            {
                var from = value.substr(0, value.indexOf("-", 1)).trim();
                var upto = value.substr(value.indexOf("-", 1) +1).trim();

                if (layerStyle.type == 'int' || layerStyle.type == 'float') 
                {
                    from = parseFloat( from);
                    upto = parseFloat( upto);
                    val = parseFloat( val);

                    if (val >= from && val <= upto) {
                        return style;
                    }
                } else {
                    if (val == from || val == upto) {
                        return style;
                    }
                }
            } else {
                if (layerStyle.type == 'int' || layerStyle.type == 'float') 
                { 
                    if (val == style.value || (prior && val > prior && val < style.value)) {
                        return style;
                    }
                } else {
                    if (val == style.value) {
                        return style;
                    }
                }
            }

            prior = style.value;
        }
    },
    
    onEachFeature: function(feature, layer) 
    {
        var that = this.that;
        var layerStyle = this.param.styles;
        
        var items = that.getItems( that, feature.properties);
        var popupContent = "<div class='modal-body' style='width: 287px'>" +
                           "<p>" +items.join( "") +"</p>" +"</div>";

        if (feature.properties && feature.properties.popupContent) {
            layer.bindPopup(feature.properties.popupContent);
        }

        layer.bindPopup(popupContent);

        if (layer.feature && layer.feature.geometry)
        {
            var type = layer.feature.geometry.type;

            if (type == 'Marker' || type == 'MultiPoint' || type == 'Point') 
            {
                if (layerStyle && layerStyle.style) 
                {
                    var val = feature.properties[ layerStyle.field];
                    var style = that.getStyle( val, layerStyle);

                    if (style) 
                    {
                        if (layer._layers)
                           layer._layers[ layer._leaflet_id -1].options.icon = that.iconCount( val, that.valColor( style.color));
                        else
                           layer.options.icon = that.iconCount( val, that.valColor( style.color));
                    }

                } else {
                    if (layer._layers)
                       layer._layers[ layer._leaflet_id -1].setIcon( that.layerIcon);
                    else
                       layer.setIcon( that.layerIcon);
                }
            }                        
        }
        
        layer.on({
            //mouseover: highlightFeature,
            //mouseout: resetHighlight,
            //click: zoomToFeature
        });                            
    },
    
    valColor: function( c)
    {
        if (c && c.indexOf( "#") == -1)
            return '#' +c;
        else
            return c;
    },
    
    getColor: function(d, layerStyle) 
    {
        var that = this;
        
        if (layerStyle && layerStyle.style)
            {
                var style = that.getStyle( d, layerStyle); 

                if (style)
                    return that.valColor( style.color);
            }
        else    
        return d > 1000 ? '#800026' :
               d > 500  ? '#BD0026' :
               d > 200  ? '#E31A1C' :
               d > 100  ? '#FC4E2A' :
               d > 50   ? '#FD8D3C' :
               d > 20   ? '#FEB24C' :
               d > 10   ? '#FED976' :
                          '#FFEDA0';
    },
    
    style: function(feature, that, layerStyle) 
    {
        var value = feature.id; 

        if (layerStyle && layerStyle.field) {
            if (feature.properties[ layerStyle.field.toLowerCase()]) {
               value = feature.properties[ layerStyle.field.toLowerCase()];
            }
        }

        return {
            fillColor: that.getColor( value, layerStyle),
            weight: 1,
            opacity: 1,
            //zIndex: 100000 -value,
            color: 'white',
            dashArray: '',
            fillOpacity: 0.7
        };
    },    
    
    setIcon: function( url, width, height)
    {
        var userIcon = L.Icon.extend({ options: {iconUrl: url, iconSize: [width, height], iconAnchor: [ Math.round( width/2), height -1], popupAnchor: [0, -height +Math.round( width/2)]}});
        this.layerIcon = new userIcon();
    }
});
