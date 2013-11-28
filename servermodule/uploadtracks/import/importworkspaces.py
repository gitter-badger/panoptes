import os
import DQXDbTools
import config
import customresponders.uploadtracks.VTTable as VTTable
import SettingsLoader
import ImportUtils
import uuid
import sys
import shutil
import customresponders.uploadtracks.Utils as Utils


def ImportCustomData(datasetId, workspaceid, tableInfo, folder):
    tableid = tableInfo['id']
    primkey = tableInfo['primkey']
    print('#### IMPORTING CUSTOM DATA into {0}, {1}, {2} FROM {3}'.format(datasetId, workspaceid, tableid, folder))

    # Load & create properties
    properties = []
    for fle in os.listdir(os.path.join(folder, 'properties')):
        if os.path.isfile(os.path.join(folder, 'properties', fle)):
            if fle.find('~') < 0:
                properties.append({'propid':fle})
    print('Properties: '+str(properties))

    for property in properties:
        propid = property['propid']
        settings = SettingsLoader.SettingsLoader(os.path.join(folder, 'properties', propid))
        settings.DefineKnownTokens(['isCategorical', 'minval', 'maxval', 'decimDigits', 'showInBrowser', 'showInTable', 'categoryColors'])
        settings.ConvertToken_Boolean('isCategorical')
        settings.RequireTokens(['Name', 'DataType'])
        settings.AddTokenIfMissing('Order', 99999)
        property['DataType'] = settings['DataType']
        property['Order'] = settings['Order']
        extraSettings = settings.Clone()
        extraSettings.DropTokens(['Name', 'DataType', 'Order','SummaryValues'])
        sql = "INSERT INTO propertycatalog VALUES ('{0}', 'custom', '{1}', '{2}', '{3}', '{4}', {5}, '{6}')".format(
            workspaceid,
            settings['DataType'],
            propid,
            tableid,
            settings['Name'],
            settings['Order'],
            extraSettings.ToJSON()
        )
        print('SQL command: '+sql)
        ImportUtils.ExecuteSQL(datasetId, sql)
        property['settings'] = settings

    properties = sorted(properties, key=lambda k: k['Order'])
    propidList = []
    propDict = {}
    for property in properties:
        propDict[property['propid']] = property
        propidList.append(property['propid'])

    # Load datatable
    print('Loading data table')
    tb = VTTable.VTTable()
    tb.allColumnsText = True
    try:
        tb.LoadFile(os.path.join(folder, 'data'))
    except Exception as e:
        raise Exception('Error while reading file: '+str(e))
    print('---- ORIG TABLE ----')
    tb.PrintRows(0, 9)

    for property in properties:
        if not tb.IsColumnPresent(property['propid']):
            raise Exception('Missing column "{0}" in datatable "{1}"'.format(property['propid'], tableid))

    if not tb.IsColumnPresent(primkey):
        raise Exception('Missing primary key '+primkey)

    for col in tb.GetColList():
        if (col not in propDict) and (col != primkey):
            tb.DropCol(col)
    tb.ArrangeColumns(propidList)
    for property in properties:
        propid = property['propid']
        if property['DataType'] == 'Value':
            tb.ConvertColToValue(propid)
        if property['DataType'] == 'Boolean':
            tb.MapCol(propid, ImportUtils.convertToBooleanInt)
            tb.ConvertColToValue(propid)
    print('---- PROCESSED TABLE ----')
    tb.PrintRows(0, 9)


    tmptable = Utils.GetTempID()
    tmpfile_create = ImportUtils.GetTempFileName()
    tmpfile_dump = ImportUtils.GetTempFileName()
    tb.SaveSQLCreation(tmpfile_create, tmptable)
    tb.SaveSQLDump(tmpfile_dump, tmptable)
    ImportUtils.ExecuteSQLScript(tmpfile_create, datasetId)
    ImportUtils.ExecuteSQLScript(tmpfile_dump, datasetId)
    os.remove(tmpfile_create)
    os.remove(tmpfile_dump)

    sourcetable=Utils.GetTableWorkspaceProperties(workspaceid, tableid)

    db = DQXDbTools.OpenDatabase(datasetId)
    cur = db.cursor()

    print('Indexing new information')
    cur.execute('CREATE UNIQUE INDEX {1} ON {0}({1})'.format(tmptable, primkey))

    # Dropping columns that will be replaced
    #cur.execute('SELECT propid FROM propertycatalog WHERE (workspaceid="{0}") and (source="custom") and (tableid="{1}")'.format(workspaceid, tableid))
    #existingProperties = []
    #for row in cur.fetchall():
    #    existProperty= row[0]
    #    if existProperty in propidList:
    #        existingProperties.append(row[0])
    #if len(existingProperties) > 0:
    #    print('Removing outdated information')
    #    for prop in existingProperties:
    #        cur.execute('DELETE FROM propertycatalog WHERE (workspaceid="{0}") and (propid="{1}") and (tableid="{2}")'.format(workspaceid, prop, tableid))
    #    sql = "ALTER TABLE {0} ".format(sourcetable)
    #    for prop in propidList:
    #        if prop != propidList[0]:
    #            sql += " ,"
    #        sql += "DROP COLUMN {0}".format(prop)
    #    print('=========== STATEMENT '+sql)
    #    cur.execute(sql)



    print('Creating new columns')
    frst = True
    sql = "ALTER TABLE {0} ".format(sourcetable)
    for property in properties:
        propid = property['propid']
        if not frst:
            sql += " ,"
        sqldatatype = 'varchar(50)'
        if property['DataType'] == 'Value':
            sqldatatype = 'float'
        sql += "ADD COLUMN {0} {1}".format(propid, sqldatatype)
        frst = False
    print('=========== STATEMENT '+sql)
    cur.execute(sql)


    print('Joining information')
    frst = True
    sql = "update {0} left join {1} on {0}.{2}={1}.{2} set ".format(sourcetable, tmptable, primkey)
    for property in properties:
        propid = property['propid']
        if not frst:
            sql += " ,"
        sql += "{0}.{2}={1}.{2}".format(sourcetable,tmptable,propid)
        frst = False
    print('=========== STATEMENT '+sql)
    cur.execute(sql)


    print('Cleaning up')
    cur.execute("DROP TABLE {0}".format(tmptable))

    Utils.UpdateTableInfoView(workspaceid, tableid, cur)

    db.commit()
    db.close()





def ImportWorkspace(datasetId, workspaceid, folder):
    print('##### IMPORTING WORKSPACE '+workspaceid)
    settings = SettingsLoader.SettingsLoader(os.path.join(folder, 'settings'))
    settings.RequireTokens(['Name'])
    print(settings.ToJSON())
    workspaceName = settings['Name']

    db = DQXDbTools.OpenDatabase(datasetId)
    cur = db.cursor()

    cur.execute('SELECT id, primkey FROM tablecatalog')
    tables = [ { 'id': row[0], 'primkey': row[1] } for row in cur.fetchall()]
    tableMap = {table['id']:table for table in tables}

    for table in tables:
        tableid = table['id']
        cur.execute("CREATE TABLE {0} AS SELECT {1} FROM {2}".format(Utils.GetTableWorkspaceProperties(workspaceid, tableid), table['primkey'], tableid) )
        cur.execute("create unique index {1} on {0}({1})".format(Utils.GetTableWorkspaceProperties(workspaceid, tableid), table['primkey']) )

    cur.execute("INSERT INTO workspaces VALUES (%s,%s)", (workspaceid, workspaceName) )
    for table in tables:
        Utils.UpdateTableInfoView(workspaceid, table['id'], cur)

    db.commit()
    db.close()

    print('############ SCANNING FOR CUSTOM DATA')
    for tableid in os.listdir(os.path.join(folder, 'customdata')):
        if os.path.isdir(os.path.join(folder, 'customdata', tableid)):
            if not tableid in tableMap:
                raise Exception('Invalid table id '+tableid)
            for customid in os.listdir(os.path.join(folder, 'customdata', tableid)):
                if os.path.isdir(os.path.join(folder, 'customdata', tableid, customid)):
                    ImportCustomData(datasetId, workspaceid, tableMap[tableid], os.path.join(folder, 'customdata', tableid, customid))


def ImportWorkspaces(datasetFolder, datasetId):
    workspaces = []
    for dir in os.listdir(os.path.join(datasetFolder, 'workspaces')):
        if os.path.isdir(os.path.join(datasetFolder, 'workspaces', dir)):
            workspaces.append(dir)
    for workspace in workspaces:
        ImportWorkspace(datasetId, workspace, os.path.join(datasetFolder, 'workspaces', workspace))
