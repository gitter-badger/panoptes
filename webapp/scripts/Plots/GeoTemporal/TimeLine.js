define(["require", "DQX/base64", "DQX/Application", "DQX/DataDecoders", "DQX/Framework", "DQX/Controls", "DQX/Msg", "DQX/SQL", "DQX/DocEl", "DQX/Utils", "DQX/Wizard", "DQX/Popup", "DQX/PopupFrame", "DQX/Map", "DQX/DataFetcher/DataFetchers", "Wizards/EditQuery", "DQX/GMaps/PointSet",
    "MetaData",
    "Utils/QueryTool", "Plots/GenericPlot", "Utils/TimeLineView"],
    function (require, base64, Application, DataDecoders, Framework, Controls, Msg, SQL, DocEl, DQX, Wizard, Popup, PopupFrame, Map, DataFetchers, EditQuery, PointSet,
              MetaData,
              QueryTool, GenericPlot, TimeLineView) {

        var TimeLine = {};




        TimeLine.Create = function(thePlot) {
            var that = {};
            that.thePlot = thePlot;
            that.tableInfo = thePlot.tableInfo;

            that.createView = function() {
                that.myTimeLine = TimeLineView.Create(that.frame);
                that.myTimeLine.setOnViewPortModified(DQX.ratelimit(that.updateTimeViewPort,50));
                that.myTimeLine.setOnTimeRangeSelected(that.fetchTimeRangeSelection);
            };


            that.createControls = function() {
                var propList = [];
                $.each(MetaData.customProperties, function(idx, propInfo) {
                    if ( (propInfo.tableid == that.tableInfo.id) && (propInfo.isDate) )
                        propList.push({id:propInfo.propid, name:propInfo.name});
                });
                that.ctrlDateProperty = Controls.Combo(null,{ label:'Date:', states: propList, value:propList[0].id }).setClassID('dateprop');
                that.ctrlDateProperty.setOnChanged(function() {
                    that.fetchData();
                });

                that.ctrl_restrictToTimeViewPort = Controls.Check(null,{ label: 'Restrict to viewport'}).setClassID('restricttotimeviewport');
                that.ctrl_restrictToTimeViewPort.setOnChanged(function() {
                    if (that.ctrl_restrictToTimeViewPort.getValue())
                        that.updateTimeViewPort();
                    else {
                        that.thePlot.pointSet.setPointFilter('timeFilter', null);
                        that.thePlot.updateMapPoints();
                        that.thePlot.reDraw();
                    }
                });

                that.ctrl_showTimeBarsAsPercentage = Controls.Check(null,{ label: 'Show as percentage'}).setClassID('showtimeaspercentage');
                that.ctrl_showTimeBarsAsPercentage.setOnChanged(function() {
                    that.thePlot.reDraw();
                });

                var groupTimeControls = Controls.CompoundVert([that.ctrlDateProperty, that.ctrl_showTimeBarsAsPercentage, that.ctrl_restrictToTimeViewPort]).setLegend('<h4>Time line</h4>');


                return groupTimeControls;
            }


            that.addFetchProperties = function(fetcher) {
                that.datePropId = that.ctrlDateProperty.getValue();
                fetcher.addColumn(that.datePropId, 'F4');
            }

            that.processFetchedPoints = function(pointData, points) {
                if (that.datePropId) {
                    var times = pointData[that.datePropId];
                    for (var nr =0; nr<points.length; nr++) {
                        points[nr].dateJD = times[nr];
                    }
                }
            }

            that.clearPoints = function() {
                that.myTimeLine.clearPoints();
            };

            that.setPoints = function(points, settings) {
                that.myTimeLine.setPoints(points, settings);

            };

            that.draw = function() {
                that.myTimeLine.setDrawStyle({
                    showTimeBarsAsPercentage: that.ctrl_showTimeBarsAsPercentage.getValue()
                });
                that.myTimeLine.draw();
            }

            that.updateSelection = function() {
                that.myTimeLine.updateSelection();
            }

            that.updateTimeViewPort = function() {
                if (that.ctrl_restrictToTimeViewPort.getValue()) {
                    var timeRange = that.myTimeLine.getVisibleTimeRange();
                    that.thePlot.pointSet.setPointFilter('timeFilter', function(pt) {
                        return (pt.dateJD<timeRange.min)||(pt.dateJD>timeRange.max);
                    });
                    that.thePlot.updateMapPoints();
                    that.thePlot.pointSet.draw();
                }
            }


            that.fetchTimeRangeSelection = function(JDmin, JDmax) {
                if (!that.thePlot.points)  return;
                var points = that.thePlot.points;
                var selectionInfo = that.tableInfo.currentSelection;
                var modified = false;
                for (var nr =0; nr<points.length; nr++) {
                    var sel = (points[nr].dateJD>=JDmin) && (points[nr].dateJD<=JDmax);
                    if (sel!=!!(selectionInfo[points[nr].id])) {
                        modified = true;
                        that.tableInfo.selectItem(points[nr].id, sel);
                    }
                }
                if (modified)
                    Msg.broadcast({type:'SelectionUpdated'}, that.tableInfo.id);
            }

            that.storeSettings = function() {
                var obj = {};
                obj.timeLine = that.myTimeLine.storeSettings();
                return obj;
            }

            that.recallSettings = function(settObj) {
                that.myTimeLine.recallSettings(settObj.timeLine);
            }


            return that;

        }




        return TimeLine;
    });

