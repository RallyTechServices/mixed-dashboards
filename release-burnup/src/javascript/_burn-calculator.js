Ext.define("Rally.techservices.burn.ReleaseBurnCalculator", {
    extend: "Rally.data.lookback.calculator.TimeSeriesCalculator",

    config: {
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
         * The release the chart is based on. 
         * (Passed in as an object (record.getData()).
         * Used for planned end date calcs.)
         * 
         */
        release: null,
        
        /**
         * 
         * @cfg {Boolean} showTrend
         * Pass true to show a trend line from the actual start through the value 
         * of today and intersecting the scope line.  
         * 
         * For the trend line to show:
         * * This must be true
         * * There must be at least two accepted values
         * * There must not be an actual end date
         * * Today must be on the chart
         */
        showTrend: true,
        trendColor: null,
        
        plotLines: []
    },

    getDerivedFieldsOnInput: function () {
        var acceptedStateNames = this.config.completedScheduleStateNames;

        if (this.config.chartAggregationType === 'storycount') {
            return [
                {
                    "as": "StoryCount",
                    "f": function(snapshot) {
                        return 1;
                    }
                },
                {
                    "as": "AcceptedStoryCount",
                    "f": function(snapshot) {
                        if(snapshot.ScheduleState == 'Accepted'){
                            return 1;
                        }else{
                            return 0;
                        }
                        
                    }
                }
            ];
        } else {
            return [
                {
                    "as": "StoryPoints",
                    "f": function(snapshot) {
                        //retrun planestimate
                        return snapshot.PlanEstimate;
                    }
                },
                {
                    "as": "AcceptedStoryPoints",
                    "f": function(snapshot) {
                        //check if accepted planestimate
                        if(snapshot.ScheduleState == 'Accepted'){
                            return snapshot.PlanEstimate;
                        }else{
                            return 0;
                        }
                    }
                }
            ];
        }
    },

    getMetrics: function() {
        if(this.config.chartAggregationType === 'storycount') {
            return [
                {
                    "field": "StoryCount",
                    "as": "Planned",
                    "f": "sum",
                    "display": "line"
                },
                {
                    "field": "AcceptedStoryCount",
                    "as": "Accepted",
                    "f": "sum",
                    "display": "column"
                }
            ];
        } else {
            return [
                {
                    "field": "StoryPoints",
                    "as": "Planned",
                    "display": "line",
                    "f": "sum"
                },
                {
                    "field": "AcceptedStoryPoints",
                    "as": "Accepted",
                    "f": "sum",
                    "display": "column"
                }
            ];
        }
    },

    runCalculation: function (snapshots, snapshotsToSubtract) {
        var highcharts_data = this.callParent(arguments);
        //console.log('inside runCalculation >>>',highcharts_data)
        var initial_length = highcharts_data.categories.length

        if ( this.hideBarsAfterToday ) {
            highcharts_data = this._stripFutureBars(highcharts_data);
        }
        
        if ( this.showTrend ) {
            highcharts_data = this._addTrend(highcharts_data);
        }
        
        this._addPlotlines(highcharts_data);
        
        this._stripBarsAfterInitalLengh(highcharts_data,initial_length);    
        

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
    
    _addPlotlines: function(data) {
        
        this.plotLines = [];
        
        var today_index = this._getDateIndexFromDate(data,new Date());
        if ( today_index > -1 ) {
            this.plotLines.push({
                color: '#000',
                label: { text: 'today' },
                width: 2,
                value: today_index
            });
        }
        
        var planned_end_date = null;
        
        if ( this.release && this.release.TargetDate ) {
            planned_end_date = this.release.TargetDate;
        }
        
        if ( planned_end_date ) {
            var end_date_index = this._getDateIndexFromDate(data, Rally.util.DateTime.add( planned_end_date, 'day', -1 ));
            
            if ( end_date_index > -1 ) {
                
                this.plotLines.push({
                    color: '#000',
                    label: { text: 'planned end' },
                    width: 2,
                    value: end_date_index
                });
            }
        }

        if ( this.trend_date ) {
            
            var show_line = true;
            if ( planned_end_date && Math.abs(Rally.util.DateTime.getDifference(this.trend_date, planned_end_date, 'day')) < 4 ) {
                show_line = false;
            }
            
            var projected_date_index = this._getDateIndexFromDate(data, this.trend_date);
            
            if ( end_date_index > -1 && show_line ) {
                this.plotLines.push({
                    color: '#000',
                    label: { text: 'projected end' },
                    width: 2,
                    value: projected_date_index
                });
            }
        }
    },
    
    _stripFutureBars: function(data) {
        var today_index = this._getDateIndexFromDate(data,new Date());
        
        if ( today_index > -1 ) {
            Ext.Array.each(data.series, function(series) {
                if ( series.name == "Accepted" ) {
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
    
    //calculates the midpoint on the trendline and strips rest of the x axis.
    // http://classroom.synonym.com/calculate-trendline-2709.html
    //http://cs.selu.edu/~rbyrd/math/slope/

    _stripBarsAfterInitalLengh: function(data,initial_length) {
        
        var difference_in_length = data.categories.length - initial_length;
        
        data.categories.splice(initial_length,difference_in_length); 
        var trend_series = [];
        Ext.Array.each(data.series, function(series) {
            if ( series.name == "Trend" ) {
                trend_series = series;
            }
        });

        if(trend_series.data){
            var x1 = this._getIndexOfFirstNonzeroFromArray(trend_series.data); //index of first non zero value on trend series
            var y1 = trend_series.data[x1]; //first non zero value on trend series

            var x2 = this._getIndexOfLastNonzeroFromArray(trend_series.data) ; //index of last non zero element
            var y2 = trend_series.data[x2];

            //calculate slope based on the above values

            // var sum_xy = 2 * ((x1 * y1) + (x2 * y2))

            // var sumx_sumy = (x1 + x2) * (y1 + y2);

            // var sum_sq_x = 2 * (x1*x1 + x2*x2);

            // var sum_x_sq = (x1 + x2) * (x1 + x2);

            // var slope = (sum_xy - sumx_sumy) / (sum_sq_x - sum_x_sq);

            var slope = (y2 - y1) / (x2 - x1);

            // calculate y-intercept

            var sum_y = y1 + y2;

            var slope_x = slope * (x1 + x2);

            var y_intercept = (sum_y - slope_x) / 2 

            var new_end_value = slope * initial_length + y_intercept

            Ext.Array.each(data.series, function(series) {
                if ( series.name == "Trend" ) {
                    series.data[series.data.length] = new_end_value;
                }
                series.data.splice(initial_length,difference_in_length); 

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

    _getIndexOfLastNonzeroFromArray:function(data) {
        var index = -1;
        for (var i = data.length - 1; i >= 0; i--) {
            if ( data[i] > 0 && index == -1 ) {
                index = i;
            }        
        }
        return index;
    },
    
    _addTrend: function(data) {
        console.log('inside _addTrend >>', data)
        // if ( Ext.isEmpty(this.PI) && Ext.isEmpty(this.PIs)) {
        //     return data;
        // }

        var accepted_series = [];
        var scope_series = [];
        
        Ext.Array.each( data.series, function(s) {
            if ( s.name == "Accepted" ) {
                accepted_series = s;
            }
            if ( s.name == "Planned" ) {
                scope_series = s;
            }
        });
        
        var index_of_first_accepted = -1;
        // is there an actual value today?  
        var index_of_today = this._getDateIndexFromDate(data,new Date());
        if ( index_of_today <= 0 ) {
            // need at least two days of data
            console.log("Cannot show trend because the chart needs to start before today");
            return data;
        }
        
        var index_of_first_nonzero = this._getIndexOfFirstNonzeroFromArray(accepted_series.data);

        var today_actual = accepted_series.data[index_of_today];
        var first_actual = accepted_series.data[index_of_first_nonzero];

        if ( today_actual <= first_actual ) {
            console.log("There's no slope to show because current actual is less than or equal to first actual");
            return data;
        }
        
        var slope =  ( today_actual - first_actual ) / ( index_of_today - index_of_first_nonzero ) ;
        
        var scope = scope_series.data[index_of_today];
        
        var calculation_date_limit = Rally.util.DateTime.add(new Date(), 'year', 2);
        this.trend_date = new Date();
        var trend_value = today_actual;
        
        while ( this.trend_date < calculation_date_limit && trend_value <= scope ) {
            this.trend_date = Rally.util.DateTime.add(this.trend_date,'day',1);
            this.trend_date = this._shiftOffWeekend(this.trend_date);
            trend_value = trend_value + slope;
        }
        
        //this.PI.ProjectedEndDate = this.trend_date;
        data = this._setTrendLineSeries(data, index_of_first_nonzero, first_actual, this.trend_date, scope);
        console.log('exit _addTrend >>', data)

        return data;
    },
    
    _shiftOffWeekend: function(check_date) {
        if (check_date.getDay() == 6) {check_date = Rally.util.DateTime.add(check_date,'day',1);} // Saturday
        if (check_date.getDay() == 0) {check_date = Rally.util.DateTime.add(check_date,'day',1);} // Sunday
        
        return check_date;
    },
    
    _setTrendLineSeries: function(data, index_of_first_nonzero, first_actual, end_date, end_value) {
        
        var end_date_iso = Rally.util.DateTime.toIsoString(end_date).replace(/T.*$/,'');
        var current_chart_end = data.categories[ data.categories.length - 1];
        
        if ( current_chart_end < end_date_iso ) {
            data = this._padDates(data, current_chart_end, end_date);
        }
        
        var index_of_end = this._getDateIndexFromDate(data,end_date);
        var trend_data = [];
        
        for ( var i=0; i<data.categories.length; i++) {
            if ( i==index_of_end ) { 
                trend_data.push(end_value); 
            } else if ( i==index_of_first_nonzero ) { 
                trend_data.push(first_actual); 
            } else {
                trend_data.push(null);
            }
        }
        data.series.push({
            color: this.trendColor || Rally.techservices.Colors.getTrendLineColor() || 'black',
            dashStyle: 'Solid',
            data: trend_data,
            name: 'Trend',
            type: 'line',
            connectNulls: true
        });
        return data;
        
    },
    
    _padDates: function(data,current_end,new_end_date) {
        var count_beyond_current = 0;
        var next_day = Rally.util.DateTime.fromIsoString(current_end);
                
        while ( next_day < new_end_date ) {            
            next_day = Rally.util.DateTime.add(next_day, 'day', 1);
            next_day = this._shiftOffWeekend(next_day);
            var next_day_iso = Rally.util.DateTime.toIsoString(next_day).replace(/T.*$/,'');
            
            if ( next_day_iso != current_end ) {
                data.categories.push(next_day_iso);
                count_beyond_current++;
            }
        }
        
        var accepted_series = [];
        var scope_series = [];
        
        Ext.Array.each( data.series, function(s) {
            if ( s.name == "Accepted" ) {
                accepted_series = s;
            }
            if ( s.name == "Planned" ) {
                scope_series = s;
            }
        });
        
        var scope = scope_series.data[scope_series.data.length-1];
        for ( var i=0; i<count_beyond_current; i++ ) {
            scope_series.data.push(scope);
            accepted_series.data.push(null);
        }
        
        data.series = [scope_series, accepted_series];
        return data;
        
    }
        
});