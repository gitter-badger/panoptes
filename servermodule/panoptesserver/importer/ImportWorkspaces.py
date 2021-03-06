# This file is part of Panoptes - (C) Copyright 2014, Paul Vauterin, Ben Jeffery, Alistair Miles <info@cggh.org>
# This program is free software licensed under the GNU Affero General Public License.
# You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>

import os
import DQXDbTools
import DQXUtils
import config
import ImportSettings
import ImpUtils
import customresponders.panoptesserver.Utils as Utils
import simplejson
from DQXDbTools import DBCOLESC
from DQXDbTools import DBTBESC

from BaseImport import BaseImport
from ImportCustomData import ImportCustomData

class ImportWorkspaces(BaseImport):
    
    #Retrieve and validate settings
    def getSettings(self, workspaceid):
        #Not _fetchSettings because no properties
        settingsFile, data = self._getDataFiles(workspaceid)
         
        settings = self._globalSettings
        
        return settings
    
    def ImportWorkspace(self, workspaceid):
        with self._logHeader('Importing workspace {0}.{1}'.format(self._datasetId, workspaceid)):
            DQXUtils.CheckValidTableIdentifier(workspaceid)
            
            settings = self.getSettings(workspaceid)
            self._log(str(settings))
            workspaceName = settings['Name']
    
            if not ImpUtils.IsDatasetPresentInServer(self._calculationObject.credentialInfo, self._datasetId):
                raise Exception('Dataset {0} is not found. Please import the dataset first'.format(self._datasetId))
    
            with DQXDbTools.DBCursor(self._calculationObject.credentialInfo, self._datasetId) as cur:
    
                def execSQL(cmd):
                    self._calculationObject.LogSQLCommand(cmd)
                    cur.execute(cmd)
    
                tables = self._getTablesInfo()
    
                if not self._importSettings['ConfigOnly']:
                    for table in tables:
                        tableid = table['id']
                        print('Re-creating custom data table for '+tableid)
                        self._dropTable(Utils.GetTableWorkspaceProperties(workspaceid, tableid))
                        execSQL("CREATE TABLE {0} (StoredSelection TINYINT DEFAULT 0) AS SELECT {1} FROM {2}".format(
                            DBTBESC(Utils.GetTableWorkspaceProperties(workspaceid, tableid)),
                            DBCOLESC(table['primkey']),
                            DBTBESC(tableid)
                        ))
                        execSQL("create unique index {1} on {0}({1})".format(
                            DBTBESC(Utils.GetTableWorkspaceProperties(workspaceid, tableid)),
                            DBCOLESC(table['primkey']))
                        )
                        execSQL("create index idx_StoredSelection on {0}(StoredSelection)".format(Utils.GetTableWorkspaceProperties(workspaceid, tableid)) )
    
                print('Removing existing workspace properties')
                execSQL("DELETE FROM propertycatalog WHERE workspaceid='{0}'".format(workspaceid) )
    
                self._log('Creating StoredSelection columns')
                for table in tables:
                    tableid = table['id']
                    sett = '{"CanUpdate": true, "Index": false, "ReadData": false, "showInTable": false, "Search":"None" }'
                    cmd = "INSERT INTO propertycatalog VALUES ('{0}', 'custom', 'Boolean', 'StoredSelection', '{1}', 'Stored selection', 0, '{2}')".format(workspaceid, tableid, sett)
                    execSQL(cmd)
    
                print('Re-creating workspaces record')
                execSQL("DELETE FROM workspaces WHERE id='{0}'".format(workspaceid) )
                execSQL('INSERT INTO workspaces VALUES ("{0}","{1}")'.format(workspaceid, workspaceName) )
                if not self._importSettings['ConfigOnly']:
                    print('Updating views')
                    for table in tables:
                        Utils.UpdateTableInfoView(workspaceid, table['id'], table['settings']['AllowSubSampling'], cur)
    
                cur.commit()
    
            
            importCustom = ImportCustomData(self._calculationObject, self._datasetId, self._importSettings, workspaceId = workspaceid, baseFolder = self._datatablesFolder,  dataDir = 'customdata')
            
            importCustom.importAllCustomData()
            
            for table in tables:
                self.CheckMaterialiseWorkspaceView(workspaceid, table['id'])
    
    def CheckMaterialiseWorkspaceView(self, workspaceId, tableid):
    
        if self._importSettings['ConfigOnly']:
            return
    
        print('Checking for materialising of {0},{1},{2}'.format(self._datasetId, workspaceId, tableid))
        with DQXDbTools.DBCursor(self._calculationObject.credentialInfo, self._datasetId) as cur:
            tablesInfo = self._getTablesInfo(tableid)
            tableSettings = tablesInfo[0]["settings"]
            #print('Table settings= '+tableSettings)
            if tableSettings['CacheWorkspaceData']:
                print('Executing materialising')
                cur.execute('show indexes from {0}'.format(tableid))
                indexedColumns1 = [indexRow[4] for indexRow in cur.fetchall()]
                cur.execute('show indexes from {0}INFO_{1}'.format(tableid, workspaceId))
                indexedColumns2 = [indexRow[4] for indexRow in cur.fetchall()]
                indexedColumns = set(indexedColumns1+indexedColumns2)
                print('Indexed columns: ' + str(indexedColumns))
                tmptable = '_tmptable_'
                wstable = '{0}CMB_{1}'.format(tableid, workspaceId)
                self._dropTable(tmptable)
                sql = 'CREATE TABLE {0} as SELECT * FROM {1}'.format(tmptable, DBTBESC(wstable))
                self._execSql(sql)
                for indexedColumn in indexedColumns:
                    sql = 'CREATE INDEX {0} ON {1}({0})'.format(DBCOLESC(indexedColumn), DBTBESC(tmptable))
                    self._execSql(sql)

                if tableSettings['IsPositionOnGenome']:
                    self._log('Indexing chromosome,position on materialised view')
                    sql = 'create index mt1_chrompos ON {0}({1},{2})'.format(
                                                                             DBTBESC(tmptable),
                                                                             DBCOLESC(tableSettings['Chromosome']),
                                                                             DBCOLESC(tableSettings['Position'])
                                                                             )
                    self._execSql(sql)

                self._dropView(DBTBESC(wstable))
                self._execSql('RENAME TABLE {0} TO {1}'.format(tmptable, DBTBESC(wstable)))
    
                if tableSettings['AllowSubSampling']:
                    print('Processing subsampling table')
                    indexedColumnsSubSampling = set(indexedColumns1 + indexedColumns2 + ['RandPrimKey'])
                    tmptable = '_tmptable_'
                    wstable = '{0}CMBSORTRAND_{1}'.format(tableid, workspaceId)
                    self._dropTable(tmptable)
                    sql = 'CREATE TABLE {0} as SELECT * FROM {1}'.format(tmptable, DBTBESC(wstable))
                    self._execSql(sql)
                    for indexedColumn in indexedColumnsSubSampling:
                        sql = 'CREATE INDEX {0} ON {1}({0})'.format(DBCOLESC(indexedColumn), DBTBESC(tmptable))
                        self._execSql(sql)
                    self._dropView(DBTBESC(wstable))
                    self._execSql('RENAME TABLE {0} TO {1}'.format(tmptable, DBTBESC(wstable)))
    
    def importAllWorkspaces(self):
    
    
        workspaces = self._getTables()
        print('Importing workspace data')
        if len(workspaces) == 0:
            print('No data: skipping')
            return
        
        for workspace in workspaces:
            self.ImportWorkspace(workspace)
            
