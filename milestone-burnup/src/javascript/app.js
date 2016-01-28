Ext.define("TSMilestoneBurnupWithCommonSelector", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'selector_box'},
        {xtype:'container',itemId:'display_box'}
    ],
    
    mixins: [
        'Rally.apps.charts.DateMixin'
    ],

    integrationHeaders : {
        name : "TSMilestoneBurnupWithCommonSelector"
    },
    
    config: {
        defaultSettings: {
            showCount:  true
        }
    },
                        
    launch: function() {
        var me = this;
        this._setupEvents();

        var selector_box = this.down('#selector_box');
        selector_box.removeAll();
        
        selector_box.add({
            xtype:'rallymilestonecombobox',
            listeners: {
                scope: this,
                change: function(cb) {
                    this._updateData(cb.getRecord());
                }
            }
        });
    },
    
    _setupEvents: function () {
        this.addEvents(
            'updateBeforeRender',
            'updateAfterRender'
        );
    },
    
    _updateData: function(timebox) {
        this.logger.log('_updateData', timebox);
        this.milestone = timebox;
        
        var display_box = this.down('#display_box');
        display_box.removeAll();
        display_box.add(this._getChartConfig());
    },
    
    _getMilestoneObjectID: function() {
        return this.milestone && this.milestone.get('ObjectID');
    },
    
    _getChartConfig: function() {
        var me = this;
        return {
            xtype: 'rallychart',
            queryErrorMessage: "No data to display.<br /><br />Most likely, stories are either not yet available or started for this milestone.",
            
            storeType: 'Rally.data.lookback.SnapshotStore',
            storeConfig: {
                find: {
                    'Milestones': me._getMilestoneObjectID(),
                    '_TypeHierarchy': 'PortfolioItem'
                },
                fetch: ['AcceptedLeafStoryCount','AcceptedLeafStoryPlanEstimateTotal','ActualStartDate','ActualEndDate','LeafStoryCount','LeafStoryPlanEstimateTotal'],
                sort: {
                    "_ValidFrom": 1
                }
            },
            calculatorType: 'Rally.techservices.burn.MilestoneBurnCalculator',
            calculatorConfig: {
                workDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                timeZone: "GMT",
                completedScheduleStateNames: ["Accepted"],
                hideBarsAfterToday: true,
                showTrend: true,
                chartAggregationType: me.getSetting('showCount') ? "storycount" : "storypoints",
                milestone: me.milestone.getData(),
                endDate: me.milestone.get('TargetDate')
            },
            
            chartColors: [],
            
            chartConfig: {
                chart: {
                },
                
                title: me._buildChartTitle(me.milestone),
                xAxis: me._buildXAxis(),
                yAxis: me._buildYAxis(),
                tooltip: {
                    formatter: function () {
                        return "" + this.x + "<br />" + this.series.name + ": " + this.y;
                    }
                },
                plotOptions: {
                    series: {
                        marker: {
                            enabled: false,
                            states: {
                                hover: {
                                    enabled: true
                                }
                            }
                        },
                        groupPadding: 0.01
                    },
                    line: {
                        color: Rally.techservices.Colors.getBurnLineColor()
                    },
                    column: {
                        stacking: null,
                        color: Rally.techservices.Colors.getBurnColumnColor(),
                        shadow: false
                    }
                }
            }
        }
    },
    
    _buildChartTitle: function (artifacts) {
        this.logger.log('_buildChartTitle', artifacts);
        
        var widthPerCharacter = 10,
            totalCharacters = Math.floor(this.getWidth() / widthPerCharacter),
            title = "Milestone Chart",
            align = "center";

        if (!Ext.isEmpty(artifacts)) {
            if ( !Ext.isArray(artifacts) ) { artifacts = [artifacts]; }
            
            if ( artifacts.length == 1 ) {
                title = artifacts[0].get('FormattedID') + ": " + artifacts[0].get('Name');
            } else if ( artifacts.length > 1 ) {
                title = Ext.Array.map(artifacts, function(artifact) { return artifact.get('FormattedID'); }).join(',');
            }
        }

        if (totalCharacters < title.length) {
            title = title.substring(0, totalCharacters) + "...";
            align = "left";
        }

        return {
            text: title,
            align: align,
            margin: 30
        };
    },
    
    _buildXAxis: function() {
        var me = this;
        return {
            categories: [],
            tickmarkPlacement: "on",
            tickInterval: 5,
            title: {
//                text: "Days",
//                margin: 10
            },
            labels: {
                x: 0,
                y: 20,
                formatter: function () {
                    return me._formatDate(me.dateStringToObject(this.value));
                }
            }
        };
    },
    
    _buildYAxis: function() {
        var me = this;
        return [
            {
                title: {
                    text: me.getSetting('showCount') ? "Count" : "Points"
                }
            }
        ];
    },
    
    _getRallyDateFormat: function () {
        var dateFormat = this._getUserConfiguredDateFormat() || this._getWorkspaceConfiguredDateFormat();

        for (var i = 0; i < this.dateFormatters.length; i++) {
            dateFormat = dateFormat.replace(this.dateFormatters[i].key, this.dateFormatters[i].value);
        }

        return dateFormat;
    },

    _formatDate: function (date) {
        if (!this.dateFormat) {
            this.dateFormat = this._getRallyDateFormat();
        }

        return Ext.Date.format(date, this.dateFormat);
    },
    
    _getUserConfiguredDateFormat: function () {
        return this.getContext().getUser().UserProfile.DateFormat;
    },

    _getWorkspaceConfiguredDateFormat: function () {
        return this.getContext().getWorkspace().WorkspaceConfiguration.DateFormat;
    },
    
    getSettingsFields: function() {
        return [
            {
                name: 'showCount',
                xtype: 'rallycheckboxfield',
                boxLabelAlign: 'after',
                fieldLabel: '',
                margin: '0 0 25 200',
                boxLabel: 'Show by Count<br/><span style="color:#999999;"><i>Tick to use story count.  Otherwise, uses story points.</i></span>'
            }
        ];
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
