import os
import DQXDbTools
import DQXUtils
import config
import customresponders.uploadtracks.VTTable as VTTable
import SettingsLoader
import ImpUtils
import LoadTable
import uuid
import sys
import shutil
import customresponders.uploadtracks.Utils as Utils


tableOrder = 0

def ImportDataTable(calculationObject, datasetId, tableid, folder, importSettings):
    global tableOrder
    with calculationObject.LogHeader('Importing datatable {0}'.format(tableid)):
        print('Source: ' + folder)
        DQXUtils.CheckValidIdentifier(tableid)

        tableSettings = SettingsLoader.SettingsLoader(os.path.join(os.path.join(folder, 'settings')))
        tableSettings.RequireTokens(['NameSingle', 'NamePlural', 'PrimKey'])
        tableSettings.AddTokenIfMissing('IsPositionOnGenome', False)
        tableSettings.AddTokenIfMissing('MaxTableSize', None)
        extraSettings = tableSettings.Clone()
        extraSettings.DropTokens(['PrimKey', 'IsPositionOnGenome', 'Properties'])

        if tableSettings['MaxTableSize'] is not None:
            print('WARNING: table size limited to '+str(tableSettings['MaxTableSize']))

        # Add to tablecatalog
        extraSettings.ConvertStringsToSafeSQL()
        sql = "INSERT INTO tablecatalog VALUES ('{0}', '{1}', '{2}', {3}, '{4}', {5})".format(
            tableid,
            tableSettings['NamePlural'],
            tableSettings['PrimKey'],
            tableSettings['IsPositionOnGenome'],
            extraSettings.ToJSON(),
            tableOrder
        )
        ImpUtils.ExecuteSQL(calculationObject, datasetId, sql)
        tableOrder += 1

        properties = ImpUtils.LoadPropertyInfo(calculationObject, tableSettings, os.path.join(folder, 'data'))

        ranknr = 0
        for property in properties:
            propid = property['propid']
            settings = property['Settings']
            extraSettings = settings.Clone()
            extraSettings.DropTokens(['Name', 'DataType', 'Order','SummaryValues'])
            sql = "INSERT INTO propertycatalog VALUES ('', 'fixed', '{0}', '{1}', '{2}', '{3}', {4}, '{5}')".format(
                settings['DataType'],
                propid,
                tableid,
                settings['Name'],
                ranknr,
                extraSettings.ToJSON()
            )
            ImpUtils.ExecuteSQL(calculationObject, datasetId, sql)
            if settings.HasToken('Relation'):
                relationSettings = settings.GetSubSettings('Relation')
                calculationObject.Log('Creating relation: '+relationSettings.ToJSON())
                relationSettings.RequireTokens(['TableId'])
                relationSettings.AddTokenIfMissing('ForwardName', 'belongs to')
                relationSettings.AddTokenIfMissing('ForwardName', 'has')
                sql = "INSERT INTO relations VALUES ('{0}', '{1}', '{2}', '{3}', '{4}', '{5}')".format(
                    tableid,
                    propid,
                    relationSettings['TableId'],
                    '',
                    relationSettings['ForwardName'],
                    relationSettings['ReverseName']
                )
                ImpUtils.ExecuteSQL(calculationObject, datasetId, sql)
            ranknr += 1



        propidList = []
        propDict = {}
        for property in properties:
            propDict[property['propid']] = property
            propidList.append(property['propid'])

        if tableSettings['IsPositionOnGenome']:
            if 'chrom' not in propDict:
                raise Exception('Genome-related datatable {0} is missing property "chrom"'.format(tableid))
            if 'pos' not in propDict:
                raise Exception('Genome-related datatable {0} is missing property "pos"'.format(tableid))

        if not importSettings['ConfigOnly']:
            columns = [ {'name': prop['propid'], 'DataType': prop['DataType'], 'Index': prop['Settings']['Index'] }
                        for prop in properties if prop['propid'] != 'AutoKey']
            LoadTable.LoadTable(
                calculationObject,
                os.path.join(folder, 'data'),
                datasetId,
                tableid,
                columns,
                tableSettings
            )
            if tableSettings['IsPositionOnGenome']:
                calculationObject.Log('Indexing chromosome')
                scr = ImpUtils.SQLScript(calculationObject)
                scr.AddCommand('create index {0}_chrompos ON {0}(chrom,pos)'.format(tableid))
                scr.Execute(datasetId)



        print('Creating summary values')
        for property in properties:
            propid = property['propid']
            settings = property['Settings']
            if settings.HasToken('SummaryValues'):
                with calculationObject.LogHeader('Creating summary values for {0}.{1}'.format(tableid,propid)):
                    summSettings = settings.GetSubSettings('SummaryValues')
                    if settings.HasToken('minval'):
                        summSettings.AddTokenIfMissing('MinVal', settings['minval'])
                    summSettings.AddTokenIfMissing('MaxVal', settings['maxval'])
                    sourceFileName = os.path.join(folder, 'data')
                    destFolder = os.path.join(config.BASEDIR, 'SummaryTracks', datasetId, propid)
                    if not os.path.exists(destFolder):
                        os.makedirs(destFolder)
                    dataFileName = os.path.join(destFolder, propid)
                    ImpUtils.ExtractColumns(calculationObject, sourceFileName, dataFileName, ['chrom', 'pos', propid], False)
                    ImpUtils.CreateSummaryValues(
                        calculationObject,
                        summSettings,
                        datasetId,
                        tableid,
                        'fixed',
                        '',
                        propid,
                        settings['Name'],
                        dataFileName,
                        importSettings
                    )

        if tableSettings.HasToken('TableBasedSummaryValues'):
            calculationObject.Log('Processing table-based summary values')
            if not type(tableSettings['TableBasedSummaryValues']) is list:
                raise Exception('TableBasedSummaryValues token should be a list')
            for stt in tableSettings['TableBasedSummaryValues']:
                summSettings = SettingsLoader.SettingsLoader()
                summSettings.LoadDict(stt)
                summSettings.RequireTokens(['Id', 'Name', 'MaxVal', 'BlockSizeMax'])
                summSettings.AddTokenIfMissing('MinVal', 0)
                summSettings.AddTokenIfMissing('BlockSizeMin', 1)
                summSettings.DefineKnownTokens(['channelColor'])
                summaryid = summSettings['Id']
                with calculationObject.LogHeader('Table based summary value {0}, {1}'.format(tableid, summaryid)):
                    extraSummSettings = summSettings.Clone()
                    extraSummSettings.DropTokens(['Id', 'Name', 'MinVal', 'MaxVal', 'BlockSizeMin', 'BlockSizeMax'])
                    sql = "INSERT INTO tablebasedsummaryvalues VALUES ('{0}', '{1}', '{2}', '{3}', {4}, {5}, {6})".format(
                        tableid,
                        summaryid,
                        summSettings['Name'],
                        extraSummSettings.ToJSON(),
                        summSettings['MinVal'],
                        summSettings['MaxVal'],
                        summSettings['BlockSizeMin']
                    )
                    ImpUtils.ExecuteSQL(calculationObject, datasetId, sql)
                    for fileid in os.listdir(os.path.join(folder, summaryid)):
                        if not(os.path.isdir(os.path.join(folder, summaryid, fileid))):
                            calculationObject.Log('Processing '+fileid)
                            destFolder = os.path.join(config.BASEDIR, 'SummaryTracks', datasetId, 'TableTracks', tableid, summaryid, fileid)
                            calculationObject.Log('Destination: '+destFolder)
                            if not os.path.exists(destFolder):
                                os.makedirs(destFolder)
                            shutil.copyfile(os.path.join(folder, summaryid, fileid), os.path.join(destFolder, summaryid+'_'+fileid))
                            ImpUtils.ExecuteFilterbankSummary(calculationObject, destFolder, summaryid+'_'+fileid, summSettings)





