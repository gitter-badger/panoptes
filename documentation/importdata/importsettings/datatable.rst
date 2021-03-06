.. _YAML: http://www.yaml.org/about.html

.. _def-settings-datatable:

Data table settings
-------------------

This YAML_ file contains settings for a :ref:`data table<dataconcept_datatable>`. See also:

- :ref:`data-import-settings`
- :ref:`data-import-adddatatable`
- `Example file
  <https://github.com/cggh/panoptes/blob/master/sampledata/datasets/Samples_and_Variants/datatables/variants/settings>`_


Possible keys
.............

NameSingle
  *Text (required).* Display name referring to a single table item (single, without starting capital).

NamePlural
  *Text (required).* Display name referring to several table items (plural, without starting capital).

Description
  *Text.*  Default:.  A short description of this data table.
  This text will appear on the intro page, and on the table view page of this data table.
  Note: this text may contain documentation links (see :ref:`def-source-docs`).

Icon
  *Text.* Specifies an icon that will be associated with the data table.
  The icon name can be chosen from the list specified in http://fortawesome.github.io/Font-Awesome/icons/.

IsHidden
  *Boolean.* If set to true, the data table will not be displayed as a standalone entity
  (i.e. not mentioned on the intro page and no tab).

PrimKey
  *PropertyID (required).* The primary key *property ID* for this table.
  A data item *property* is a column in the TAB-delimited source file ``data``, and the *ID* corresponds to the column header.
  The primary key should refer to a column containing a unique value for each record in the table.
  Optionally, this parameter can be set to '``AutoKey``' to instruct the software to automatically generate a primary key.

ItemTitle
  *Text.* A  `handlebars <http://handlebarsjs.com/>`_ template. Defaults to the primary key.
  The rendered template will be used when a data item title is needed.

SortDefault
  *PropertyID.* Specifies the property ID (i.e. column name in the ``data`` source file) used as the default sort field..

CacheWorkspaceData
  *Boolean.* If set, a materialised table will be created in the relational database for this data in each workspace.
  For large data tables (>1M records), this option is faster than the standard option, which uses a JOIN statement.

MaxCountQueryRecords
  *Value.*  Default:200000.  Defines the maximum number of records that will be downloaded to the client.
  This limit influences views that display individual data items, such as scatter plots and geographical map views.
  If not specified, this defaults to 200,000.

MaxCountQueryAggregated
  *Value.*  Default:1000000.  Defines the maximum number of records that will be queried on the server for views that present
  data items in an aggregated way, such as histograms and bar graphs.
  If not specified, this defaults to 1,000,000.

FetchRecordCount
  *Boolean.*  Default:False.  .

QuickFindFields
  *PropertyIDs.* The list of properties will be used by some tools in the software that allow the user to quickly find a (set of) item(s).

DisableSubsets
  *Boolean.* If set, there will be no subsets options for this data table.

DisablePlots
  *Boolean.* If set, there will be no options to create plots for this data table.

DisableNotes
  *Boolean.* If set, it will not be possible to define notes for items in this data table.

PropertyGroups
  *List.* Each item in the list specifies a group of properties.
  Property groups are used to combine sets of related properties into logical sections in the app.
  The block can contain the following keys:
    Id
      *Text (required).* a unique identifier for the group.

    Name
      *Text (required).* a display name.


AutoScanProperties - deprecated - please use scripts/mksettings.sh to generate a skeleton settings.gen file and use that to create a settings file
.. _Properties:
Properties
  *List.* Each list item defines a :ref:`property<dataconcept_property>`, linked to a column in the TAB-delimited source file ``data``.
  See :ref:`def-settings-datatable-properties` settings for an overview of the keys that can be used for each property in this list.

DataItemViews
  *List.* Definitions of custom views that will appear in the popup for an individual data table item.
  The block can contain the following keys:
    Type
      *Text (required).* Identifier of the custom view type
    (can be ``Overview``, ``PropertyGroup``, ``FieldList``, ``ItemMap``, ``PieChartMap``)
    See :ref:`def-settings-datatable-dataitemviews` for more details about defining custom data item views.


ExternalLinks
  *List.* Each item in the list specifies a link for a data item to an external url.
  These links show up in the app as buttons in the data item popup window.
  The block can contain the following keys:
    Url
      *Text (required).* Url for this link. This may include tokens property ID's between curly braces.
       These tokens will be expanded to their actual content for a specific data item.
       Example: ``http://maps.google.com/maps?q={Lattitude},{Longitude}``.

    Name
      *Text (required).* Display name for this external link.


ListView
  *Boolean.*  Default:False.  Replaces the normal table view with a list view, showing rows on left and a single selected row on the right.

IsPositionOnGenome
  *Boolean.*  Default:False.  Instructs Panoptes that records in this data table should be interpreted as genomic positions.
  In this case, the *Chromosome* and *Position* keys should be defined.

IsRegionOnGenome
  *Boolean.*  Default:False.  Instructs Panoptes that records in this datatable should be interpreted as genomic regions.
  In this case, the *Chromosome*, *RegionStart* and *RegionStop* keys should be defined.

BrowserTrackHeightFactor
  *Value.* Specifies a relative size factor for the genome browser track height (only applicable if *IsPositionOnGenome* or *IsRegionOnGenome* is set).

Chromosome
  *PropertyID.* Specifies the table column ID that contains the chromosome
  (only to be used if *IsPositionOnGenome* or *IsRegionOnGenome* is set).
  Note that the values in this column should correspond to the content of the ``chromosomes`` source file
  (see :ref:`def-source-referencegenome`).

Position
  *PropertyID.* Specifies the table column ID that contains the position on the chromosome
  (only to be used if *IsPositionOnGenome* is set).

RegionStart
  *PropertyID.* Specifies the table column ID that contains the start position of the region
  (only to be used if *IsRegionOnGenome* is set).

RegionStop
  *PropertyID.* Specifies the table column ID that contains the end position of the region
  (only to be used if *IsRegionOnGenome* is set).

GenomeMaxViewportSizeX
  *Value.* Specifies the maximum genome browser viewport size (in bp)
  for which individual data points from this table will be displayed in the tracks.
  (only to be used if *IsPositionOnGenome* or *IsRegionOnGenome* is set).

BrowserDefaultVisible
  *Boolean.* For genomic regions: specifies the default visibility status of this data table in the genome browser
  (only to be used if *IsRegionOnGenome* is set).
  Note that, for genomic position, default visibility is specified on a per-property basis.

AllowSubSampling
  *Boolean.*  Default:False.  .

MaxTableSize
  *Value.*  Default:None.  .

BrowserDefaultLabel
  *PropertyID.* Specifies the default label that is used in the genome browser, used for genomic regions.
  None indicates that no label is displayed by default.

TableBasedSummaryValues
  *List.* Declares that numerical genome values for are available for each item in the table.
  Panoptes will process these using the multiresolution filterbanking, and the user can display these as tracks in the genome browser.
  A typical use case is if the data table contains samples that were sequenced, and there is coverage data available

  *Approach 1*

  There should be a subdirectory named after the identifier of this track in the data table source data folder.
  For each data item, this directory should contain a data file with the name equal to the primary key
  (see `example <https://github.com/cggh/panoptes/tree/master/sampledata/datasets/Samples_and_Variants/datatables/samples/SampleSummary1>`_).
  The input files should not contain a header row

  The Id is the identifier of this set of per-data-item genomic values i.e. the name of the subdirectory

  *Approach 2*

  This approach is more like the way the table based data files are processed.
  In this case multiple tracks can be stored in the same input file.
  The Id corresponds to the column name instead of the directory name with the directory details given in the FilePattern expression
  The name is the first match in the FilePattern expression
.
  The block can contain the following keys:
    Id
      *Text (required).* Identifier of this set of per-data-item genomic values - name of subdirectory or Identifier of this set of per-data-item genomic values - name of the column in the matching files.

    FilePattern
      *Text.* A glob (regular expression) containing a relative path to the file(s).

    Name
      *Text (required).* Display name of the property.

    MinVal
      *Value (required).*  Default:0.  Value used for lower extent of scales.

    MaxVal
      *Value (required).* Value used for upper extent of scales.

    BlockSizeMin
      *Value (required).*  Default:1.  Minimum block size used by the multiresolution summariser (in bp).

    BlockSizeMax
      *Value (required).* Maximum block size used by the multiresolution summariser (in bp).

    ChannelColor
      *Text.* Colour used to display these tracks as a genome browser track. Formatted as ``"rgb(r,g,b)"``.





.. toctree::
  :maxdepth: 1

  datatable_properties
  datatable_dataitemviews

