// This file is part of Panoptes - (C) Copyright 2014, CGGH <info@cggh.org>
// This program is free software licensed under the GNU Affero General Public License. 
// You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>
define(["require", "DQX/base64", "DQX/Application", "DQX/Framework", "DQX/Controls", "DQX/Msg", "DQX/SQL", "DQX/DocEl", "DQX/Utils", "DQX/QueryTable", "DQX/Map", "DQX/SVG",
        "DQX/Wizard", "DQX/Popup", "DQX/PopupFrame", "DQX/ChannelPlot/GenomePlotter", "DQX/ChannelPlot/ChannelYVals", "DQX/ChannelPlot/ChannelPositions", "DQX/ChannelPlot/ChannelSequence","DQX/DataFetcher/DataFetchers", "DQX/DataFetcher/DataFetcherSummary",
        "MetaData", "Utils/GetFullDataItemInfo", "Utils/MiscUtils"
    ],
    function (require, base64, Application, Framework, Controls, Msg, SQL, DocEl, DQX, QueryTable, Map, SVG,
              Wizard, Popup, PopupFrame, GenomePlotter, ChannelYVals, ChannelPositions, ChannelSequence, DataFetchers, DataFetcherSummary,
              MetaData, GetFullDataItemInfo, MiscUtils
        ) {

        var ItemPropertyLine = {};

        ItemPropertyLine.createTableLine = function(tableInfo, propid, itemData) {

            var parentFieldsMap = {};
            if (itemData.parents)
                $.each(itemData.parents, function(idx, parentInfo) {
                    parentFieldsMap[parentInfo.tableid] = parentInfo.fields;
                });

            var content = '';
            var linkAction = null;
            var linkIcon = null;
            if (propid.indexOf('@')<0) {//property from this table
                var propInfo = MetaData.findProperty(tableInfo.id, propid);
                fieldContent = itemData.fields[propid];
                if (propInfo.relationParentTableId) {
                    linkAction = function() {
                        Msg.send({type: 'ItemPopup'}, {
                            tableid: propInfo.relationParentTableId,
                            itemid: itemData.fields[propid]
                        });
                    };
                    linkIcon = "fa-external-link-square";
                }
                if (propInfo.settings.ExternalUrl) {
                    linkAction = function() {
                        var url = propInfo.settings.ExternalUrl.DQXformat({value: propInfo.toDisplayString(itemData.fields[propid])});
                        window.open(url,'_blank');
                    };
                    linkIcon = "fa fa-external-link";
                }
            }
            else {//property from a parent table
                var parenttableid = propid.split('@')[1];
                propid = propid.split('@')[0];
                var propInfo = MetaData.findProperty(parenttableid, propid);
                if (!parentFieldsMap[parenttableid])
                    DQX.reportError('Missing parent item data for '+parenttableid);
                fieldContent = parentFieldsMap[parenttableid][propid];
            }
            content += '<tr>';
            content += '<td style="padding-bottom:3px;padding-top:3px;white-space:nowrap" title="{hint}"><b>{name}</b></td>'.DQXformat({
                hint: (propInfo.settings.Description)||'',
                name: propInfo.name
            });
            content += '<td style="padding-left:5px;word-wrap:break-word;">';
            var displayedString = propInfo.toDisplayString(fieldContent);
            if (!linkAction) {
                content += displayedString;
            }
            else {
                var lnk = Controls.Hyperlink(null,{ content: '<span class="fa {icon}" style="font-size: 120%"></span> {content}'.DQXformat({icon:linkIcon, content: displayedString})});
                lnk.setOnChanged(linkAction);
                content += lnk.renderHtml();
            }
            content += "</td>";
            content += "</tr>";
            return content;
        };


        return ItemPropertyLine;
    });



