define(["require", "DQX/base64", "DQX/Application", "DQX/Framework", "DQX/Controls", "DQX/Msg", "DQX/SQL", "DQX/DocEl", "DQX/Utils", "DQX/Wizard", "DQX/Popup", "DQX/PopupFrame", "DQX/ChannelPlot/GenomePlotter", "DQX/ChannelPlot/ChannelYVals", "DQX/ChannelPlot/ChannelPositions", "DQX/ChannelPlot/ChannelSequence","DQX/DataFetcher/DataFetchers", "DQX/DataFetcher/DataFetcherSummary", "MetaData"],
    function (require, base64, Application, Framework, Controls, Msg, SQL, DocEl, DQX, Wizard, Popup, PopupFrame, GenomePlotter, ChannelYVals, ChannelPositions, ChannelSequence, DataFetchers, DataFetcherSummary, MetaData) {

        var ItemPopup = {};

        ItemPopup.init = function() {
            Msg.listen('',{type:'ItemPopup'}, function(scope, info) {
                ItemPopup.show(info);
            });
        }

        ItemPopup.show = function(itemInfo) {
            var myurl = DQX.Url(MetaData.serverUrl);
            myurl.addUrlQueryItem("datatype", 'recordinfo');
            var primkey = MetaData.getTableInfo(itemInfo.tableid).primkey;
            myurl.addUrlQueryItem("qry", SQL.WhereClause.encode(SQL.WhereClause.CompareFixed(primkey, '=', itemInfo.itemid)));
            myurl.addUrlQueryItem("database", MetaData.database);
            myurl.addUrlQueryItem("tbname", itemInfo.tableid + 'CMB_' + MetaData.workspaceid);
            $.ajax({
                url: myurl.toString(),
                success: function (resp) {
                    DQX.stopProcessing();
                    var keylist = DQX.parseResponse(resp);
                    if ("Error" in keylist) {
                        alert(keylist.Error);
                        return;
                    }
                    ItemPopup.show_sub1(itemInfo, keylist.Data);
                },
                error: DQX.createMessageFailFunction()
            });
            DQX.setProcessing("Downloading...");
        }


        ItemPopup.show_sub1 = function(itemInfo, data) {
            var content='';//JSON.stringify(data);
            var propertyMap = {};
            $.each(MetaData.customProperties, function(idx,propInfo) {
                if (propInfo.tableid == itemInfo.tableid) {
                    propertyMap[propInfo.name] = propInfo.toDisplayString(data[propInfo.propid]);
                }
            });
            content += DQX.CreateKeyValueTable(propertyMap);

/*            if (('pos' in data) && ('chrom' in data)) {
                content += bt.renderHtml();
            }*/

            var that = PopupFrame.PopupFrame('ItemPopup'+itemInfo.tableid, {title:itemInfo.itemid, blocking:false, sizeX:700, sizeY:500 });
            that.itemid = itemInfo.itemid;
            that.tableInfo = MetaData.getTableInfo(itemInfo.tableid);

            that.createFrames = function() {
                that.frameRoot.makeGroupVert();
                that.frameBody = that.frameRoot.addMemberFrame(Framework.FrameFinal('', 0.7))
                    .setAllowScrollBars(true,true);
                that.frameButtons = that.frameRoot.addMemberFrame(Framework.FrameFinal('', 0.3))
                    .setFixedSize(Framework.dimY, 70).setFrameClassClient('DQXGrayClient');
            };

            that.createPanels = function() {
                that.frameBody.setContentHtml(content);
                that.panelButtons = Framework.Form(that.frameButtons);

                var buttons = [];

                if (that.tableInfo.hasGenomePositions) {
                    buttons.push(Controls.HorizontalSeparator(7));
                    var bt = Controls.Button(null, { content: 'Show on genome'}).setOnChanged(function() {
                        //that.close();//!!!todo: only when blocking
                        Msg.send({ type: 'JumpgenomePosition' }, {chromoID:data.chrom, position:parseInt(data.pos) });
                    })
                    buttons.push(bt)
                }

                if (that.tableInfo.tableBasedSummaryValues.length>0) {
                    buttons.push(Controls.HorizontalSeparator(7));
                    var chk = Controls.Check(null, {
                            label: 'Show Genome tracks',
                            value:that.tableInfo.genomeTrackSelectionManager.isItemSelected(that.itemid)
                        }).setOnChanged(function() {
                        that.tableInfo.genomeTrackSelectionManager.selectItem(that.itemid,chk.getValue())
                    })
                    buttons.push(chk)
                }

                that.panelButtons.addControl(Controls.CompoundHor(buttons));
            }


            that.create();


        }


        return ItemPopup;
    });



