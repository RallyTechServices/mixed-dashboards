Ext.define("TSNonArtifactBoard", {
    extend: 'Rally.app.App',
    cls: 'kanban',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },

    settingsScope: 'project',
    autoScroll: false,
    
    mixins: [
        'Rally.Messageable'
    ],
    
    config: {
        defaultSettings: {
            groupByField: 'c_CurmudgeonState',
            showRows: false,
            columns: Ext.JSON.encode({
                None: {wip: ''}
            }),
            cardFields: 'FormattedID,Name,Owner', //remove with COLUMN_LEVEL_FIELD_PICKER_ON_KANBAN_SETTINGS
            hideReleasedCards: false,
            showCardAge: true,
            cardAgeThreshold: 3,
            pageSize: 25
        }
    },
                        
    launch: function() {
        Rally.data.ModelFactory.getModel({
            type: 'Milestone',
            success: this._onModelRetrieved,
            scope: this
        });
        
        this.subscribe(this,'requestMilestoneFilter',this._publishFilter,this);
    },

    _onModelRetrieved: function(model) {
        this.logger.log("_onModelRetrieved",model);
        
        this.groupByField = model.getField(this.getSetting('groupByField'));
        this._addCardboardContent();
    },

    _addCardboardContent: function() {
        this.logger.log('_addCardboardContent');
        
        if ( this.gridboard) { this.gridboard.destroy(); }
        
        var cardboardConfig = this._getCardboardConfig();

        var columnSetting = this._getColumnSetting();
        if (columnSetting) {
            cardboardConfig.columns = this._getColumnConfig(columnSetting);
        }

        var cardboard_config = this._getGridboardConfig(cardboardConfig);
        this.logger.log('config:', cardboard_config);
        this.gridboard = this.add(cardboard_config);
        //publish the gridboard
    },

    _getGridboardConfig: function(cardboardConfig) {
        var context = this.getContext(),
            modelNames = this._getDefaultTypes(),
            blacklist = ['Successors', 'Predecessors', 'DisplayColor'];

        return {
            xtype: 'rallygridboard',
            stateful: false,
            toggleState: 'board',
            cardBoardConfig: cardboardConfig,
            listeners: {
                            scope: this,
                            filterschanged: function(cb) {
                                console.log('cb >>>>>>>>>>>',cb);
                                this.filters = cb;
                                this._publishFilter();

                            }
                        },
           plugins: [
               // {
               //     ptype: 'rallygridboardaddnew',
               //     addNewControlConfig: {
               //         listeners: {
               //             beforecreate: this._onBeforeCreate,
               //             beforeeditorshow: this._onBeforeEditorShow,
               //             scope: this
               //         },
               //         stateful: true,
               //         stateId: context.getScopedStateId('kanban-add-new')
               //     }
               // },
               {
                   ptype: 'rallygridboardcustomfiltercontrol',
                   filterChildren: true,
                   filterControlConfig: {
                       blackListFields: [],
                       whiteListFields: ['Milestones'],
                       margin: '3 9 3 30',
                       modelNames: modelNames,
                       stateful: true,
                       stateId: context.getScopedStateId('kanban-custom-filter-button')
                      
                   }

                   // ,
                   // showOwnerFilter: true,
                   // ownerFilterControlConfig: {
                   //     stateful: true,
                   //     stateId: context.getScopedStateId('kanban-owner-filter')
                   // }
               },
               {
                   ptype: 'rallygridboardfieldpicker',
                   headerPosition: 'left',
                   boardFieldBlackList: blacklist,
                   modelNames: modelNames,
                   boardFieldDefaults: this.getSetting('cardFields').split(',')
               // },
               // {
               //     ptype: 'rallyboardpolicydisplayable',
               //     prefKey: 'kanbanAgreementsChecked',
               //     checkboxConfig: {
               //         boxLabel: 'Show Agreements'
               //     }
               }
           ],
            context: context,
            modelNames: modelNames,
            storeConfig: {
                filters: this._getFilters()
            },
            height: this.getHeight()
        };
    },

    _getColumnConfig: function(columnSetting) {
        this.logger.log('_getColumnConfig', columnSetting);
        var columns = [];
        Ext.Object.each(columnSetting, function(column, values) {
            var columnConfig = {
                xtype: 'kanbancolumn',
                enableWipLimit: true,
                wipLimit: values.wip,
                plugins: [{
                    ptype: 'rallycolumnpolicy',
                    app: this
                }],
                value: column,
                columnHeaderConfig: {
                    headerTpl: column || 'None'
                },
                listeners: {
                    invalidfilter: {
                        fn: this._onInvalidFilter,
                        scope: this
                    }
                }
            };
//            if(this._shouldShowColumnLevelFieldPicker()) {
//                columnConfig.fields = this._getFieldsForColumn(values);
//            }
            columns.push(columnConfig);
        }, this);

        columns[columns.length - 1].hideReleasedCards = this.getSetting('hideReleasedCards');

        return columns;
    },

    _getFieldsForColumn: function(values) {
        var columnFields = [];
//        if (this._shouldShowColumnLevelFieldPicker()) {
//            if (values.cardFields) {
//                columnFields = values.cardFields.split(',');
//            } else if (this.getSetting('cardFields')) {
//                columnFields = this.getSetting('cardFields').split(',');
//            }
//        }
        return columnFields;
    },

    _onInvalidFilter: function() {
        Rally.ui.notify.Notifier.showError({
            message: 'Invalid query: ' + this.getSetting('query')
        });
    },

    _getCardboardConfig: function() {
        var config = {
            xtype: 'rallycardboard',
            plugins: [
                //{ptype: 'rallycardboardprinting', pluginId: 'print'},
                {
                    ptype: 'rallyscrollablecardboard',
                    containerEl: this.getEl()
                },
                {ptype: 'rallyfixedheadercardboard'}
            ],
            types: this._getDefaultTypes(),
            attribute: this.getSetting('groupByField'),
            margin: '10px',
            context: this.getContext(),
            // listeners: {
            //    // beforecarddroppedsave: this._onBeforeCardSaved,
            //    // load: this._onBoardLoad,
            //    // cardupdated: this._publishContentUpdatedNoDashboardLayout,
            // },
            columnConfig: {
                xtype: 'rallycardboardcolumn',
                enableWipLimit: true
            },
            cardConfig: {
                editable: true,
                showIconMenus: true,
                showAge: this.getSetting('showCardAge') ? this.getSetting('cardAgeThreshold') : -1,
                showBlockedReason: true
            },
            storeConfig: {
                context: this.getContext().getDataContext()
            }
        };
        if (this.getSetting('showRows')) {
            Ext.merge(config, {
                rowConfig: {
                    field: this.getSetting('rowsField'),
                    sortDirection: 'ASC'
                }
            });
        }
        return config;
    },


    _getFilters: function() {
        var filters = [];

        var andFilters = Ext.create('Rally.data.wsapi.Filter',{
            property: 'Projects',
            operator: 'contains',
            value: this.getContext().getProject()._ref
        });

        andFilters = andFilters.or({
            property: 'TargetProject',
            value: null
        });

        if(this.getSetting('query')) {
            filters.push(Rally.data.QueryFilter.fromQueryString(this.getSetting('query')));
        }
        if(this.getContext().getTimeboxScope()) {
            filters.push(this.getContext().getTimeboxScope().getQueryFilter());
        }

        andFilters.and(filters);

        return andFilters;
    },

    _getColumnSetting: function() {
        var columnSetting = this.getSetting('columns');
        return columnSetting && Ext.JSON.decode(columnSetting);
    },

    _onBoardLoad: function() {
        this._publishContentUpdated();
        this.setLoading(false);
    },

    _onBeforeCreate: function(addNew, record, params) {
        Ext.apply(params, {
            rankTo: 'BOTTOM',
            rankScope: 'BACKLOG'
        });
        record.set(this.getSetting('groupByField'), this.gridboard.getGridOrBoard().getColumns()[0].getValue());
    },

    _onBeforeEditorShow: function(addNew, params) {
        params.rankTo = 'BOTTOM';
        params.rankScope = 'BACKLOG';
        params.iteration = 'u';

        var groupByFieldName = this.groupByField.name;

        params[groupByFieldName] = this.gridboard.getGridOrBoard().getColumns()[0].getValue();
    },

    _getDefaultTypes: function() {
        return ['Milestone'];
//        return ['User Story', 'Defect'];
    },

    _onBeforeCardSaved: function(column, card, type) {
        var columnSetting = this._getColumnSetting();
        if (columnSetting) {
            var setting = columnSetting[column.getValue()];
//            
//            if (setting && setting.stateMapping && card.getRecord().get('_type') == 'defect') {
//                card.getRecord().set('State', setting.stateMapping);
//            }
        }
    },

    _publishFilter: function() {
        this.publish('milestoneFilterChanged', this.filters);
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

    getSettingsFields: function() {
        return Rally.apps.kanban.Settings.getFields({
            //shouldShowColumnLevelFieldPicker: this._shouldShowColumnLevelFieldPicker(),
            defaultCardFields: this.getSetting('cardFields')
        });
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        this.launch();
    }
});
