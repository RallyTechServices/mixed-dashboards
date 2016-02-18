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
        'Rally.apps.charts.DateMixin',
        'Rally.Messageable'
    ],

    integrationHeaders : {
        name : "TSMilestoneBurnupWithCommonSelector"
    },
    
    config: {
        defaultSettings: {
            showCount:  true,
            showScopeSelector:  true,
            startDateField: 'c_PlannedStartDate',
            endDateField: 'c_PlannedEndDate'
        }
    },

    launch: function() {
        var me = this;
        this._setupEvents();
        
        var settings = this.getSettings();
        
        if ( settings.showScopeSelector == true || settings.showScopeSelector == "true" ) {
            this._addSelector();
            this.subscribe(this,'requestTimebox',this._publishTimebox,this);
        } else {
            this.logger.log('burnup, subscribing');
            this.subscribe(this, 'timeboxChanged', this._updateData, this);
            this.logger.log('requesting current timebox');
            this.publish('requestTimebox', this);
        }
    },

    _addSelector: function() {
        var selector_box = this.down('#selector_box');
            selector_box.removeAll();
            
        var filters = Ext.create('Rally.data.wsapi.Filter',{
            property: 'Projects',
            operator: 'contains',
            value: this.getContext().getProject()._ref
        });

        filters = filters.or({
            property: 'TargetProject',
            value: null
        });


        selector_box.add({
            xtype:'rallymilestonecombobox',
            stateful: true,
            stateId: this.getContext().getScopedStateId('milestone-cb'),
            width: 200,
            fieldLabel: 'Milestone',
            labelAlign: 'right',
            context: this.getContext(),
            typeAhead : true,
            typeAheadDelay: 100,
            //autoSelect: false,
            minChars: 1, 
            storeConfig: {
                filters: filters,
                remoteFilter: true
            },
            listeners: {
                scope: this,
                change: function(cb) {
                    this._publishTimebox();
                    this._updateData(cb.getRecord());
                }
            }
        });
    },

    _publishTimebox: function() {
        this.logger.log("Publish timebox");
        var cb = this.down('rallymilestonecombobox');
        if ( cb ) {
            this.publish('timeboxChanged', cb.getRecord());
        }
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
                fetch: ['AcceptedLeafStoryCount','AcceptedLeafStoryPlanEstimateTotal','ActualStartDate','ActualStartDate','LeafStoryCount','LeafStoryPlanEstimateTotal'],
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
                startDate: me.milestone.get(me.getSetting('chartBeginField')),
                endDate: me.milestone.get(me.getSetting('chartEndField'))
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
        var me = this;

        return [
            {
                name: 'showScopeSelector',
                xtype: 'rallycheckboxfield',
                boxLabelAlign: 'after',
                fieldLabel: '',
                margin: '0 0 25 200',
                boxLabel: 'Show Scope Selector<br/><span style="color:#999999;"><i>Tick to use this to broadcast settings.</i></span>'
            },
            {
                name: 'showCount',
                xtype: 'rallycheckboxfield',
                boxLabelAlign: 'after',
                fieldLabel: '',
                margin: '0 0 25 200',
                boxLabel: 'Show by Count<br/><span style="color:#999999;"><i>Tick to use story count.  Otherwise, uses story points.</i></span>'
            },
            {
            name: 'chartBeginField',
            xtype: 'rallyfieldcombobox',
            fieldLabel: 'Chart Begin Field',
            labelWidth: 75,
            labelAlign: 'left',
            minWidth: 200,
            margin:  '0 0 25 200',
            autoExpand: false,
            alwaysExpanded: false,
            model: 'Milestone',
            listeners: {
                //TODO filterout date fields
                    ready: function(field_box) {
                        me._filterOutExceptDates(field_box.getStore());
                    }
                },
                readyEvent: 'ready'
            },
            {
            name: 'chartEndField',
            xtype: 'rallyfieldcombobox',
            fieldLabel: 'Chart End Field',
            labelWidth: 75,
            labelAlign: 'left',
            minWidth: 200,
            margin:  '0 0 25 200',
            autoExpand: false,
            alwaysExpanded: false,
            model: 'Milestone',
            listeners: {
                //TODO filterout date fields
                    ready: function(field_box) {
                        me._filterOutExceptDates(field_box.getStore());
                    }
                },
                readyEvent: 'ready'
            }
        ];
    },
    
    _filterOutExceptDates: function(store) {
        var app = Rally.getApp();
        this.logger.log('_filterOutExceptChoices');
        
        store.filter([{
            filterFn:function(field){ 
                var attribute_definition = field.get('fieldDefinition').attributeDefinition;
                var attribute_type = null;
                if ( attribute_definition ) {
                    attribute_type = attribute_definition.AttributeType;
                }
                if (  attribute_type == "BOOLEAN" ) {
                    return false;
                }
                if ( attribute_type == "DATE") {
                    if ( !field.get('fieldDefinition').attributeDefinition.Constrained ) {
                        return true;
                    }
                }
                return false;
            } 
        }]);
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