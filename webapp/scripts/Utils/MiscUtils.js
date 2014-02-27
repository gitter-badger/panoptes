define(["require", "DQX/base64", "DQX/Application", "DQX/Framework", "DQX/Controls", "DQX/Msg", "DQX/SQL", "DQX/QueryTable", "DQX/DocEl", "DQX/Utils", "DQX/Wizard", "DQX/Popup", "DQX/PopupFrame", "DQX/FrameCanvas", "DQX/DataFetcher/DataFetchers", "Wizards/EditQuery",
    "MetaData",
],
    function (require, Base64, Application, Framework, Controls, Msg, SQL, QueryTable, DocEl, DQX, Wizard, Popup, PopupFrame, FrameCanvas, DataFetchers, EditQuery,
              MetaData
        ) {

        var MiscUtils = {};

        //A helper function, turning a fraction into a color string
        var createFuncFraction2Color = function(minval, maxval) {
            var range = maxval-minval;
            if (!range)
                range = 1;
            return function (vl) {
                if (vl == null)
                    return "white";
                else {
                    vl=parseFloat(vl);
                    vl = (vl-minval) / range;
                    vl = Math.max(0, vl);
                    vl = Math.min(1, vl);
                    if (vl > 0) vl = 0.05 + vl * 0.95;
                    vl = Math.sqrt(vl);
                    var b = 255 ;
                    var g = 255 * (1 - 0.3*vl * vl);
                    var r = 255 * (1 - 0.6*vl);
                    return "rgb(" + parseInt(r) + "," + parseInt(g) + "," + parseInt(b) + ")";
                }
            };
        }


        MiscUtils.createItemTableViewerColumn = function(theTable, tableid, propid) {
            var tableInfo = MetaData.mapTableCatalog[tableid];
            var propInfo = MetaData.findProperty(tableid, propid);
            var encoding  = 'String';
            var tablePart = 1;
            if (propInfo.datatype=='Value') {
                encoding  = 'Float3';
                if (propInfo.settings.decimDigits ==0 )
                    encoding  = 'Int';
            }
            if ((propInfo.datatype=='Value') && (propInfo.propid==MetaData.getTableInfo(tableid).PositionField) && (MetaData.getTableInfo(tableid).hasGenomePositions) )
                encoding  = 'Int';
            if (propInfo.datatype=='Boolean')
                encoding  = 'Int';
            if ( (propInfo.datatype=='GeoLongitude') || (propInfo.datatype=='GeoLattitude') )
                encoding  = 'Float4';
            if ( (propInfo.datatype=='Date') )
                encoding  = 'Float4';
            if (propInfo.isPrimKey)
                tablePart = 0;
            var sortable = (!tableInfo.hasGenomePositions) || ( (propInfo.propid!=theTable.ChromosomeField) && (propInfo.propid!=theTable.PositionField) );
            var col = theTable.createTableColumn(
                QueryTable.Column(propInfo.name,propInfo.propid,tablePart),
                encoding,
                sortable
            );
            if (propInfo.settings.Description)
                col.setToolTip(propInfo.settings.Description);
            if ( (tableInfo.hasGenomePositions) && (theTable.findColumn(theTable.ChromosomeField)) && (theTable.findColumn(theTable.PositionField)) ) {
                // Define a joint sort action on both columns chromosome+position, and set it as default
                theTable.addSortOption("Position", SQL.TableSort([theTable.ChromosomeField, theTable.PositionField]),true);
            }

            if (propInfo.datatype=='Boolean')
                col.setDataType_MultipleChoiceInt([{id:0, name:'No'}, {id:1, name:'Yes'}]);

            if (propInfo.propid==tableInfo.ChromosomeField)
                col.setDataType_MultipleChoiceString(MetaData.chromosomes);

            if (propInfo.propCategories) {
                var cats = [];
                $.each(propInfo.propCategories, function(idx, cat) {
                    cats.push({id:cat, name:cat});
                });
                col.setDataType_MultipleChoiceString(cats);
            }


            if (propInfo.isPrimKey) {
                col.setCellClickHandler(function(fetcher,downloadrownr) {
                    var itemid = theTable.getCellValue(downloadrownr,propInfo.propid);
                    Msg.send({ type: 'ItemPopup' }, { tableid: tableid, itemid: itemid } );
                })
            }

            if (propInfo.relationParentTableId) {
                col.setCellClickHandler(function(fetcher,downloadrownr) {
                    var itemid=theTable.getCellValue(downloadrownr,propInfo.propid);
                    Msg.send({ type: 'ItemPopup' }, { tableid: propInfo.relationParentTableId, itemid: itemid } );
                })
            }

            col.CellToText = propInfo.toDisplayString;
            col.CellToTextInv = propInfo.fromDisplayString;

            if ( (propInfo.isFloat) && (propInfo.settings.hasValueRange) )
                col.CellToColor = createFuncFraction2Color(propInfo.settings.minval, propInfo.settings.maxval); //Create a background color that reflects the value

            if (propInfo.isBoolean)
                col.CellToColor = function(vl) { return vl?DQX.Color(0.75,0.85,0.75):DQX.Color(1.0,0.9,0.8); }

            return col;
        }


        MiscUtils.createDataItemTable = function(frameTable, tableInfo, query, settings) {
            //Initialise the data fetcher that will download the data for the table
            var theDataFetcher = DataFetchers.Table(
                MetaData.serverUrl,
                MetaData.database,
                tableInfo.id + 'CMB_' + MetaData.workspaceid
            );

            var panelTable = QueryTable.Panel(
                frameTable,
                theDataFetcher,
                { leftfraction: 50 }
            );
            var theTable = panelTable.getTable();
            theTable.fetchBuffer = 300;

            theTable.recordCountFetchType = DataFetchers.RecordCountFetchType.NONE;
            if (tableInfo.settings.FetchRecordCount)
                theTable.recordCountFetchType = DataFetchers.RecordCountFetchType.DELAYED;

            theTable.setQuery(query);

            if (settings.hasSelection) {
                theTable.createSelectionColumn("sel", "", tableInfo.id, tableInfo.primkey, tableInfo, DQX.Color(1,0,0), function() {
                    Msg.broadcast({type:'SelectionUpdated'}, tableInfo.id);
                });
            }

            $.each(MetaData.customProperties, function(idx, propInfo) {
                if (propInfo.tableid == tableInfo.id)
                    if ( (propInfo.settings.showInTable) && (tableInfo.isPropertyColumnVisible(propInfo.propid)))
                    {
                        var col = MiscUtils.createItemTableViewerColumn(theTable, tableInfo.id, propInfo.propid);
                    }
            });
            panelTable.onResize();

            return panelTable;
        }


        MiscUtils.selectQuery = function(tableInfo, query) {
            var maxcount = 100000;
            var fetcher = DataFetchers.RecordsetFetcher(MetaData.serverUrl, MetaData.database, tableInfo.id + 'CMB_' + MetaData.workspaceid);
            fetcher.setMaxResultCount(maxcount);
            fetcher.addColumn(tableInfo.primkey, 'ST');
            DQX.setProcessing();
            fetcher.getData(query, tableInfo.primkey,
                function (data) { //success
                    DQX.stopProcessing();
                    var items = data[tableInfo.primkey];
                    if (items.length >= maxcount)
                        alert('WARNING: maximum number of items reached. Only {nr} will be selected'.DQXformat({nr: maxcount}))
                    $.each(items, function(idx, item) {
                        tableInfo.selectItem(item, true);
                    });
                    Msg.broadcast({type:'SelectionUpdated'}, tableInfo.id);
                },
                function (data) { //error
                    DQX.stopProcessing();
                    DQX.reportError('Query failed');
                }

            );
        };




        MiscUtils.createDateScaleInfo = function(optimDist, zoomFact) {
            var dist,shear;
            var minShear = 1.0e9;
            var calcShear = function(dst) {
                return Math.abs(dst/optimDist-1.0);
            }
            var rs = {
                namedDays: null,
                monthInterval: null,
                yearInterval: null
            };

            // try each day
            dist = 1*zoomFact;
            shear = calcShear(dist);
            if (shear<minShear) {
                minShear = shear;
                rs.namedDays = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,39,31];
            }

            // try each 2 days
            dist = 2*zoomFact;
            shear = calcShear(dist);
            if (shear<minShear) {
                minShear = shear;
                rs.namedDays = [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30];
            }

            // try each 5 days
            dist = 5*zoomFact;
            shear = calcShear(dist);
            if (shear<minShear) {
                minShear = shear;
                rs.namedDays = [1,5,10,15,20,25];
            }

            // try each 10 days
            dist = 10*zoomFact;
            shear = calcShear(dist);
            if (shear<minShear) {
                minShear = shear;
                rs.namedDays = [1,10,20];
            }

            // try each 15 days
            dist = 15*zoomFact;
            shear = calcShear(dist);
            if (shear<minShear) {
                minShear = shear;
                rs.namedDays = [1,15];
            }

            // try month multiples
            $.each([1,2,3,6,12], function(idx, mult) {
                dist = mult*30*zoomFact;
                shear = calcShear(dist)
                if (shear<minShear) {
                    minShear = shear;
                    rs.monthInterval = mult;
                    rs.namedDays = null;
                    rs.yearInterval = null;
                }
            })

            // try year multiples
            $.each([1,2,5,10], function(idx, mult) {
                dist = mult*365*zoomFact;
                shear = calcShear(dist)
                if (shear<minShear) {
                    minShear = shear;
                    rs.monthInterval = null;
                    rs.namedDays = null;
                    rs.yearInterval = mult;
                }
            });

            rs.isOnScale = function(year, month, day) {
                if (this.yearInterval) {
                    if ( (year%this.yearInterval == 0) && (month==1) &&(day==1) )
                        return true;
                    return false;
                }
                if (this.monthInterval) {
                    if ( ((month-1)%this.monthInterval == 0) && (day==1) )
                        return true;
                    return false;
                }
                if (this.namedDays.indexOf(day)>=0)
                    return true;
                return false;
            }

            return rs;
        }



        MiscUtils.createPropertyScale = function(tableid, propid, zoomFactor, minVal, maxVal) {
            var propInfo = MetaData.findProperty(tableid, propid);
            if (propInfo.isDate) {// Date scale
                var pad = function(n) {return n<10 ? '0'+n : n};
                var textScaleInfo = MiscUtils.createDateScaleInfo(80, zoomFactor);
                var tickScaleInfo = MiscUtils.createDateScaleInfo(20, zoomFactor);
                var ticks = [];
                var JD1IntMin = Math.floor(minVal);
                var JD1IntMax = Math.ceil(maxVal);
                for (var JDInt = JD1IntMin; JDInt<= JD1IntMax; JDInt++) {
                    var dt = DQX.JD2DateTime(JDInt);
                    var year = dt.getUTCFullYear();
                    var month = dt.getUTCMonth() + 1;
                    var day = dt.getUTCDate();
                    if (textScaleInfo.isOnScale(year, month, day)) {
                        var tick = {
                            value: JDInt,
                            label: year.toString()
                        };
                        ticks.push(tick);
                        if (!textScaleInfo.yearInterval)
                            tick.label2 = '-'+pad(month)+'-'+pad(day);
                    } else if (tickScaleInfo.isOnScale(year, month, day)) {
                        ticks.push({
                            value: JDInt
                        });
                    }
                }
                return ticks;
            }
            else {// Ordinary numerical scale
                var scale = DQX.DrawUtil.getScaleJump(30/zoomFactor);
                var ticks = [];
                for (var i=Math.ceil(minVal/scale.Jump1); i<=Math.floor(maxVal/scale.Jump1); i++) {
                    var tick = {};
                    tick.value = i*scale.Jump1;
                    if (i%scale.JumpReduc==0) {
                        tick.label = scale.value2String(tick.value);
                    }
                    ticks.push(tick);
                }
                return ticks;
            }
        };



        return MiscUtils;
    });


