# This file is part of Panoptes - (C) Copyright 2014, CGGH <info@cggh.org>
# This program is free software licensed under the GNU Affero General Public License.
# You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>

import config
import os
import uuid
import DQXDbTools
import DQXUtils
import authorization

def response(returndata):

    def CheckFolderExistence(dir, name, needWriteAccess):
        if not os.path.isdir(dir):
            raise Exception('{0} does not exist\n({1})'.format(name, dir))
        if needWriteAccess:
            try:
                tryFileName = os.path.join(dir, str(uuid.uuid1()))
                with open(tryFileName, 'w'):
                    pass
                os.remove(tryFileName)
            except:
                raise Exception('Unable to write to {0}\n({1})'.format(name, dir))


    try:

        # Check for mysql version nr
        with DQXDbTools.DBCursor(returndata) as cur:
            try:
                cur.execute('SELECT VERSION()')
                versionstring = cur.fetchone()[0]
                versiontokens = versionstring.split('.')
                if len(versiontokens) < 2:
                    raise Exception('Invalid syntax')
                version1 = int(versiontokens[0])
                version2 = int(versiontokens[1])
            except Exception as e:
                raise Exception('Unable to obtain MySQL version information: '+str(e))
            if (version1 < DQXDbTools.MySQLMinVersion[0]) or (version1 == DQXDbTools.MySQLMinVersion[0]) and (version2 < DQXDbTools.MySQLMinVersion[1]):
                raise Exception('Invalid version of MySQL: {0} (should be at least {1}.{2})'.format(
                    versionstring,
                    DQXDbTools.MySQLMinVersion[0],
                    DQXDbTools.MySQLMinVersion[1]
                ))

        # Checks for server database
        with DQXDbTools.DBCursor(returndata) as cur:
            cur.execute('SELECT id,name FROM datasetindex')

        # Checks for DQXServer BASEDIR
        CheckFolderExistence(config.BASEDIR, '[BASEDIR]', False)
        CheckFolderExistence(os.path.join(config.BASEDIR, 'temp'), '[BASEDIR]/temp', True)
        CheckFolderExistence(os.path.join(config.BASEDIR, 'Uploads'), '[BASEDIR]/Uploads', True)
        CheckFolderExistence(os.path.join(config.BASEDIR, 'SummaryTracks'), '[BASEDIR]/SummaryTracks', True)

        # Checks for source data folder
        CheckFolderExistence(os.path.join(config.SOURCEDATADIR, 'datasets'), '[SOURCEDATADIR]/datasets', False)

        # Try getting auth rules
        authorization.PnAuthRuleSet()

        DQXUtils.LogServer('PANOPTES CLIENT APP START: ' + cur.credentials.GetAuthenticationInfo())
        returndata['userid'] = cur.credentials.GetUserId()


    except Exception as e:
        DQXUtils.LogServer('SERVER CONFIGURATION ERROR: ' + str(e))
        returndata['issue'] = str(e)

    return returndata

