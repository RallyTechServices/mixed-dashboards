Ext.define("TSAlternateTimeline", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    layout: 'border', 
    
    items: [
        {xtype:'container',itemId:'display_box',layout:'border', region:'center'}
    ],

    integrationHeaders : {
        name : "TSAlternateTimeline"
    },
    
    config: {
        defaultSettings: {
            milestone_display_count: 7
        }
    },
                        
    launch: function() {
        
        var display_box = this.down('#display_box');
        display_box.removeAll();
        
        display_box.add({
            xtype:'container',
            region:'west',
            layout: 'vbox',
            items: [
                this._getUpButtonConfig(),
                { xtype:'container', flex: 1 },
                this._getDownButtonConfig()
            ]
        });
        
        display_box.add({
            xtype: 'rallychart',
            region:'center',
           
            loadMask: false,
            chartData: this._getChartData(),
            chartConfig: this._getChartConfig()
        });
    },
    
    _getUpButtonConfig: function() {
        return { 
            xtype:'rallybutton', 
            itemId: 'up_button', 
            text: '<span class="icon-up"> </span>', 
            disabled: true, 
            cls: 'secondary small',
            listeners: {
                scope: this,
                click: function() {
                    if ( this.highchart ) {
                        this._scrollUp(this.highchart);
                    }
                }
            }
        };
    },
    
    _getDownButtonConfig: function() {
        return { 
            xtype:'rallybutton', 
            itemId: 'down_button', 
            text: '<span class="icon-down"> </span>', 
            disabled: true, 
            cls: 'secondary small',
            listeners: {
                scope: this,
                click: function() {
                    if ( this.highchart ) {
                        this._scrollDown(this.highchart);
                    }
                }
            }
        };
    },
            
    /**
     * Generate x axis categories and y axis series data for the chart
     */
    _getChartData: function() {
        return {
            categories: [
                'M1: a milestone',
                'M2: a milestone',
                'M3: a milestone',
                'M4: a milestone',
                'M5: a milestone',
                'M6: a milestone',
                'M7: a milestone',
                'M8: a milestone',
                'M9: a milestone',
                'M10: a milestone',
                'M11: a milestone'
            ],
            min: 5,
            series: [
                {
                    name: 'Actual',
                    data: [ null, [6,8], [2,3], [3,8], [5,8] ]
                },
                {
                    name: 'Planned',
                    data: [ [0,10], [5,11], [0,2], [1,7], [4,8],  [0,10], [5,11], [0,2], [1,7], [4,8] ],
                    scrollbar: {
                        enabled: true,
                        barBackgroundColor: 'gray',
                        barBorderRadius: 7,
                        barBorderWidth: 0,
                        buttonBackgroundColor: 'gray',
                        buttonBorderWidth: 0,
                        buttonArrowColor: 'yellow',
                        buttonBorderRadius: 7,
                        rifleColor: 'yellow',
                        trackBackgroundColor: 'white',
                        trackBorderWidth: 1,
                        trackBorderColor: 'silver',
                        trackBorderRadius: 7
                    }
                }
            ]
        };
    },

    /**
     * Generate a valid Highcharts configuration object to specify the column chart
     */
    _getChartConfig: function() {
        var me = this;
        return {
            chart: {
                inverted: true,
                type: 'columnrange',
                events: {
                    load: function(evt) {
                        me._setChart(this);
                    }
                }
            },
            title: {
                text: ''
            },
            subtitle: {
                text: ''
            },
            xAxis: {
                min: 0,
                id: 'xAxis',
                max: me.getSetting('milestone_display_count')
            },
            yAxis: {
                id: 'yAxis',
                categories: [ 'Jan', 'Feb', 'Mar', 'April', 'May', 'June', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                min: 0,
                    title: {
                    text: ' '
                }
            },
            tooltip: {
                headerFormat: '<span style="font-size:10px">{point.key}</span><table>',
                    pointFormat: '<tr><td style="color:{series.color};padding:0">{series.name}: </td>' +
                    '<td style="padding:0"><b>{point.y:.1f} mm</b></td></tr>',
                    footerFormat: '</table>',
                    shared: true,
                    useHTML: true,
                    enabled: false
            },
            
            legend: { enabled: false },
            
            scrollbar: {
                enabled: true,
                barBackgroundColor: 'gray',
                barBorderRadius: 7,
                barBorderWidth: 0,
                buttonBackgroundColor: 'gray',
                buttonBorderWidth: 0,
                buttonArrowColor: 'yellow',
                buttonBorderRadius: 7,
                rifleColor: 'yellow',
                trackBackgroundColor: 'white',
                trackBorderWidth: 1,
                trackBorderColor: 'silver',
                trackBorderRadius: 7
            },
            
            plotOptions: {
                column: {
                    pointPadding: 0.2,
                        borderWidth: 0
                },
                columnrange: {
                    dataLabels: {
                        enabled: false,
                        formatter: function() { return this.y + "!"; }
                    }
                }
            }
        };
    },
    
    _setChart: function(chart) {
        this.highchart = chart;
        this._enableChartButtons();
    },
    
    _enableChartButtons: function() {
        var up_button = this.down('#up_button');
        var down_button = this.down('#down_button');
        
        up_button.setDisabled(true);
        down_button.setDisabled(true);
        
        if ( this.highchart ) {
            var extremes = this._getExtremes(this.highchart,'xAxis');
            
            if ( extremes.min > 0 ) {
                up_button.setDisabled(false);
            }
            
            if ( extremes.max < extremes.dataMax ) {
                down_button.setDisabled(false);
            }
        }
    },
    
    _getExtremes: function(chart, id) {
        var axis = chart.get(id); // must set the axis' id property
        return axis.getExtremes();
    },
    
    _setExtremes: function(chart, id, min, max) {
        var axis = chart.get(id); // must set the axis' id property
        var extremes = this._getExtremes(chart,id);
        
        axis.setExtremes(min,max);
        this._enableChartButtons();
    },
    
    _scrollUp: function(chart) {
        var extremes = this._getExtremes(chart,'xAxis');
        var new_max = extremes.max - 1;
        var new_min = extremes.min - 1;
        
        if ( new_min < 0 ) { new_min = 0; }
        if ( new_max < new_min + this.getSetting('milestone_display_count') - 1) { 
            new_max = new_min + this.getSetting('milestone_display_count') - 1;
        }
        
        this._setExtremes(chart,'xAxis',new_min,new_max);
    },
    
    _scrollDown: function(chart) {
        var extremes = this._getExtremes(chart,'xAxis');
        var new_max = extremes.max + 1;
        var new_min = extremes.min + 1;
        
        //if ( new_max > extremes.dataMax ) { new_max = extremes.dataMax; }
        if ( new_min > new_max - this.getSetting('milestone_display_count') + 1 ) { 
            new_min =  new_max - this.getSetting('milestone_display_count') + 1;
            if ( new_min < 0 ) { new_min = 0; }
        }
        
        this._setExtremes(chart,'xAxis',new_min,new_max);
    },
      
    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };
        this.logger.log("Starting load:",config.model);
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

    _loadAStoreWithAPromise: function(model_name, model_fields){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.logger.log("Starting load:",model_name,model_fields);
          
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(this);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    
    _displayGrid: function(store,field_names){
        this.down('#display_box').add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: field_names
        });
    },
    
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        this.launch();
    }
});
