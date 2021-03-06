# This file is part of Panoptes - (C) Copyright 2014, CGGH <info@cggh.org>
# This program is free software licensed under the GNU Affero General Public License.
# You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>

import config
import os
import uuid
import DQXDbTools
import authorization
import schemaversion

def response(returndata):


    credInfo = DQXDbTools.CredentialInformation(returndata)
    databaseName = DQXDbTools.ToSafeIdentifier(returndata['database'])

    returndata['manager'] = authorization.IsDataSetManager(credInfo, databaseName)

    needfullreload = False
    needconfigreload = False
    with DQXDbTools.DBCursor(returndata, databaseName) as cur:
        cur.execute('SELECT `content` FROM `settings` WHERE `id`="DBSchemaVersion"')
        rs = cur.fetchone()
        if rs is None:
            needfullreload = True
        else:
            majorversion = int(rs[0].split('.')[0])
            minorversion = int(rs[0].split('.')[1])
            if majorversion < schemaversion.major:
                needfullreload = True
            else:
                if (majorversion == schemaversion.major) and (minorversion < schemaversion.minor):
                    needconfigreload = True

    returndata['needfullreload'] = needfullreload
    returndata['needconfigreload'] = needconfigreload

    return returndata
