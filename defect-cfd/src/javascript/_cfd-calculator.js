Ext.define("Rally.techservices.MilestoneCFDCalculator", {
    extend: "Rally.data.lookback.calculator.TimeSeriesCalculator",

    config: {
                /*
         * Required
         */
        group_by_field: null,
        /*
         * Name of field that holds the value to add up
         * (Required if type is "sum")
         */
        value_field: null, 
        /*
         * allowed_values (Required): array of available values in field to group by
         */
         allowed_values: null,
         
        /**
         * @cfg {Boolean} hideBarsAfterToday
         * True to not display the completion bars on the chart if it extends beyond
         * the day that the app is run.  Defaults to false (show all bars flattened
         * to the right of today).
         */
        hideBarsAfterToday: false,
        /**
         * 
         * @type { Object } PI
         * The milestone the chart is based on. 
         * (Passed in as an object (record.getData()).
         * Used for planned end date calcs.)
         * 
         */
        milestone: null
        
    },

    getMetrics: function() {
        
        var metric = {
            f: 'groupBySum',
            field: this.value_field, 
            groupByField: this.group_by_field, 
            allowedValues: this.allowed_values,
            display:'area'
        };
                
        if(this.config.chartAggregationType === 'storycount') {
            metric.f = 'groupByCount';
        }
        
        return [ metric ];
        
    },
    /*
     * Modified to allow groupBySum/groupByCount to spit out stacked area configs
     */
    _buildSeriesConfig: function (calculatorConfig) {
        var aggregationConfig = [],
            metrics = calculatorConfig.metrics,
            derivedFieldsAfterSummary = calculatorConfig.deriveFieldsAfterSummary;

        for (var i = 0, ilength = metrics.length; i < ilength; i += 1) {
            var metric = metrics[i];
            if ( metric.f == "groupBySum" || metric.f == "groupByCount") {
                var type = metric.f.replace(/groupBy/,"");
                
                if ( ! metric.allowedValues ) {
                    throw "Rally.techservices.MilestoneCFDCalculator requires setting 'allowed_values'";
                }
                Ext.Array.each(metric.allowedValues,function(allowed_value){
                    aggregationConfig.push({
                        f: type,
                        name: allowed_value,
                        type: metric.display || "area",
                        dashStyle: metric.dashStyle || "Solid",
                        stack: 1
                    });
                });
            } else {
                aggregationConfig.push({
                    name: metric.as || metric.field,
                    type: metric.display,
                    dashStyle: metric.dashStyle || "Solid"
                });
            }
        }

        for (var j = 0, jlength = derivedFieldsAfterSummary.length; j < jlength; j += 1) {
            var derivedField = derivedFieldsAfterSummary[j];
            aggregationConfig.push({
                name: derivedField.as,
                type: derivedField.display,
                dashStyle: derivedField.dashStyle || "Solid"
            });
        }

        return aggregationConfig;
    },
    
    /*
     * WSAPI will give us allowed values that include "", but the
     * snapshot will actually say null
     * 
     */
    _convertNullToBlank:function(snapshots){
        var number_of_snapshots = snapshots.length;
        for ( var i=0;i<number_of_snapshots;i++ ) {
            if ( snapshots[i][this.group_by_field] === null ) {
                snapshots[i][this.group_by_field] = "";
            }
        }
        return snapshots;
    },
    
    // override runCalculation to change false to "false" because highcharts doesn't like it
    runCalculation: function (snapshots) {
        var calculatorConfig = this._prepareCalculatorConfig(),
            seriesConfig = this._buildSeriesConfig(calculatorConfig);

        var calculator = this.prepareCalculator(calculatorConfig);
        
        console.log('calculatorConfig', calculatorConfig);
        
        var clean_snapshots = this._convertNullToBlank(snapshots);

        console.log('clean_snapshots', clean_snapshots);
        
        if ( clean_snapshots.length > 0 ) {
            calculator.addSnapshots(clean_snapshots, this._getStartDate(clean_snapshots), this._getEndDate(clean_snapshots));
        }
        console.log('clean_snapshots', clean_snapshots);

        
        var highcharts_data = this._transformLumenizeDataToHighchartsSeries(calculator, seriesConfig);
        
        console.log(highcharts_data);
        
        if ( this.hideBarsAfterToday ) {
            highcharts_data = this._stripFutureBars(highcharts_data);
        }
        
        // check for false
        Ext.Array.each(highcharts_data.series,function(series){
            if ( series.name === "" ) {
                series.name = "None";
            }
            
            if (series.name === false) {
                series.name = "False";
            }
            
            if (series.name == true) {
                series.name = "True";
            }
        });
        
        return highcharts_data;
    },
    
    _getDateIndexFromDate: function(highcharts_data, check_date) {
        var date_iso = Rally.util.DateTime.toIsoString(new Date(check_date),true).replace(/T.*$/,'');
        var date_index = -1;
                
        Ext.Array.each(highcharts_data.categories, function(category,idx) {
            
            if (category >= date_iso && date_index == -1 ) {
                date_index = idx;
            }
        });
        
        if ( date_index === 0 ) {
            return date_index = -1;
        }
        return date_index;
    },
    
    _stripFutureBars: function(data) {
        var today_index = this._getDateIndexFromDate(data,new Date());
        
        if ( today_index > -1 ) {
            Ext.Array.each(data.series, function(series) {
                if ( series.type == "area" || series.type == "column" ) {
                    Ext.Array.each( series.data, function(datum,idx){
                        if ( idx > today_index ) {
                            series.data[idx] = null;
                        }
                    });
                }
            });
        }
        
        return data;
    },
    
    _getIndexOfFirstNonzeroFromArray:function(data) {
        var index = -1;
        Ext.Array.each(data,function(datum,idx){
            if ( datum > 0 && index == -1 ) {
                index = idx;
            }
        });
        return index;
    },
    
    _shiftOffWeekend: function(check_date) {
        if (check_date.getDay() == 6) {check_date = Rally.util.DateTime.add(check_date,'day',1);} // Saturday
        if (check_date.getDay() == 0) {check_date = Rally.util.DateTime.add(check_date,'day',1);} // Sunday
        
        return check_date;
    }
        
});