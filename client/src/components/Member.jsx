import React, { useState, useEffect, useRef } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { ResizableBox } from "react-resizable";
import "react-resizable/css/styles.css";
import MemberDetails from "./MemberDetails";
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Diversity3OutlinedIcon from '@mui/icons-material/Diversity3Outlined';
import Papa from 'papaparse';
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ToastContainer, toast } from 'react-toastify';

import Bottleneck from 'bottleneck';

function Member() {
  const [columns, setColumns] = useState([]);
  const [data, setData] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(100);
  const [columnWidths, setColumnWidths] = useState({});
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [trigerUseeffectByDelete, setTrigerUseeffectByDelete] = useState(false);
  const tableHeaderRef = useRef(null);
  const [file, setFile] = useState(null);
  const [refreshData, setRefreshData] = useState(false);

  const gettingOptions = JSON.parse(localStorage.getItem('filterOptions'))
  const navigate = useNavigate();
  const opt = {
    relationship: "null",
    filterMonth: "null",
    dateFrom: "",
    dateTo: ""
  }
  const [filterOptions, setFilterOptions] = useState(gettingOptions || opt);

  const searchItems = (searchValue) => {
    if (searchValue !== '') {
      const filteredData = data.filter((item) => {
        return (
          item?.firstName?.toLowerCase()?.includes(searchValue?.toLowerCase()) ||
          item?.countryCode?.toLowerCase()?.includes(searchValue?.toLowerCase()) ||
          item?.email?.toLowerCase()?.includes(searchValue?.toLowerCase())
        );
      });
      setFilteredResults(filteredData);
    } else {
      setFilteredResults(data);
    }
    setCurrentPage(1);
  };

  const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

  useEffect(() => {
    function hit() {
      fetch(`${serverUrl}/api/get-users`, {
        method: 'GET',
        headers: {
          "Content-Type":'application/json'
        },
        credentials: 'include'
      })
        .then(response => response?.json())
        .then(data => {
          if (data.length > 0) {
            const keys = Object.keys(data[0])?.filter(key => key !== '_id' && key !== '__v');
            const initialColumns = [
              { id: 'serialNumber', title: 'Sr No.' },
              // { id: 'selectAll', title: 'Select All' },
              { id: 'submittionDate', title: 'Submittion Date' },
              { id: 'firstName', title: 'First Name' },
              { id: 'lastName', title: 'Last Name' },
              { id: 'email', title: 'Email' },
              { id: 'newsletter', title: 'Newsletter' },
              { id: 'dueDate', title: 'Due Date' },
              { id: 'relationship', title: 'Relationship' },
              { id: 'countryCode', title: 'Country Code' },
            ];
            const savedColumns = JSON.parse(localStorage.getItem('columns'));
            if (savedColumns) {
              setColumns(savedColumns);
            } else {
              setColumns(initialColumns);
            }
            const rowData = data.map((item, index) => ({ ...item, originalIndex: index }));
            const enrichedData = [...rowData]?.reverse();
            setApiKeys(keys);
            setData(enrichedData);
            setFilteredResults(enrichedData);
          } else {
            const rowData = data.map((item, index) => ({ ...item, originalIndex: index }));
            const enrichedData = [...rowData]?.reverse();
            setData(enrichedData);
            setFilteredResults(enrichedData);
            setSelectAll(!selectAll);
          }
        })
        .catch((err) => {
          console.log(err, "Error in Getting Members");
          navigate('/login');

        })
      const savedWidths = JSON.parse(localStorage.getItem('columnWidths'));
      if (savedWidths) {
        setColumnWidths(savedWidths);
      }
    }
    hit()
  }, [viewingCustomer, trigerUseeffectByDelete, refreshData]);

  useEffect(() => {
    const filteredData = data.filter((item) => {
      const dueDate = new Date(item.dueDate * 1000);
      const fromCondition = filterOptions?.dateFrom ? dueDate >= new Date(filterOptions?.dateFrom) : true;
      const toDateCondition = filterOptions?.dateTo ? dueDate <= new Date(filterOptions?.dateTo) : true;
      const relationshipCondition = filterOptions?.relationship !== "null" ? item.relationship === filterOptions?.relationship : true;
      const monthYearCondition = filterOptions?.filterMonth !== "null" ? compareMonthYear(item.dueDate, filterOptions?.filterMonth) : true;

      return fromCondition && relationshipCondition && toDateCondition && monthYearCondition === true;
    });
    setFilteredResults(filteredData)
    localStorage.setItem('filterOptions', JSON.stringify(filterOptions))
  }, [filterOptions, data])

  useEffect(() => {

  }, [filteredResults])

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const updatedColumns = Array.from(columns);
    const [reorderedColumn] = updatedColumns?.splice(result.source.index, 1);
    if (result?.source?.index !== 0 && result?.source?.index !== 1) {
      updatedColumns.splice(result?.destination?.index, 0, reorderedColumn);
    }
    setColumns(updatedColumns);
    localStorage.setItem('columns', JSON.stringify(updatedColumns));
  };

  const handleToggleColumn = (key) => {
    const columnExists = columns?.find(column => column.id === key);
    let updatedColumns;
    if (columnExists) {
      updatedColumns = columns?.filter(column => column.id !== key);
    } else {
      const newColumn = { id: key, title: key.charAt(0).toUpperCase() + key.slice(1) };
      updatedColumns = [...columns, newColumn];
    }
    setColumns(updatedColumns);
    localStorage.setItem('columns', JSON.stringify(updatedColumns));
  };

  const isDate = (value) => {
    return !isNaN(Date.parse(value));
  };

  const handleSort = (columnId) => {
    let direction = 'ascending';
    if (sortConfig.key === columnId && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key: columnId, direction });

    const sortedData = [...data].sort((a, b) => {
      let aValue = a[columnId];
      let bValue = b[columnId];

      // Check if the values are dates
      if (isDate(aValue) && isDate(bValue)) {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      if (aValue < bValue) {
        return direction === 'ascending' ? -1 : 1;
      }
      if (aValue > bValue) {
        return direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });

    setData(sortedData);
    setFilteredResults(sortedData); // Update filteredResults with sorted data
  };

  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredResults?.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredResults.length / rowsPerPage);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
    window.scrollTo({
      top: tableHeaderRef.current.offsetTop,
      behavior: 'smooth',
    });
  };
  
  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    window.scrollTo({
      top: tableHeaderRef.current.offsetTop,
      behavior: 'smooth',
    });
  };
  const getPageNumbers = () => {
    const totalPageNumbersToShow = 3; // Number of page numbers to display
    const totalPageNumbers = totalPages;
    const current = currentPage;
  
    const pageNumbers = [];
  
    // Always show the first page
    pageNumbers.push(1);
  
    if (current > 3) {
      pageNumbers.push('...');
    }
  
    // Calculate start and end page numbers
    const startPage = Math.max(2, current - 1);
    const endPage = Math.min(totalPages - 1, current + 1);
  
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
  
    if (current < totalPages - 2) {
      pageNumbers.push('...');
    }
  
    // Always show the last page if there are more than one page
    if (totalPages > 1) {
      pageNumbers.push(totalPages);
    }
  
    return pageNumbers;
  };
    

  const handleResize = (columnId, width) => {
    const updatedWidths = {
      ...columnWidths,
      [columnId]: width
    };
    setColumnWidths(updatedWidths);
    localStorage.setItem('columnWidths', JSON.stringify(updatedWidths));
  };

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setSelectedRows(newSelectAll ? data.map((row) => row._id) : []);
  };

  const handleSelectRow = (id) => {
    const newSelectedRows = selectedRows.includes(id)
      ? selectedRows.filter(rowId => rowId !== id)
      : [...selectedRows, id];
    setSelectedRows(newSelectedRows);
    setSelectAll(newSelectedRows.length === data.length);
  };

  const handleResetFilter = () => {
    setFilterOptions({
      relationship: "null",
      filterMonth: "null",
      dateFrom: "",
      dateTo: ""
    })
  }

  function compareMonthYear(itemDate, monthYearStr) {
    const date = new Date(itemDate * 1000);
    const [month, year] = monthYearStr.split('_');
    const monthIndex = new Date(`${month} 1, 2022`).getMonth();
    return date.getFullYear() === parseInt(year) && date.getMonth() === monthIndex;
  }


  if (viewingCustomer) {
    return <MemberDetails customer={viewingCustomer} onBack={() => setViewingCustomer(null)} />;
  }

  const deleteRowFromTable = async () => {
    console.log(selectedRows);
    let userResponseText = selectedRows.length === 0 ? "No data Selected" : `Are you sure you want to delete ${selectedRows.length} Enquiries?`;
    const userResponse = window.confirm(userResponseText);
    if (userResponse) {
      try {
        const response = await axios.delete(`${serverUrl}/api/delete-enquiries`, {
          headers: {
            'Content-Type': 'application/json'
          },
          data: { ids: selectedRows }
        });
        console.log(response.data);
        setTrigerUseeffectByDelete(!trigerUseeffectByDelete)
      } catch (error) {
        console.error('Error:', error);
      }
    }
    setSelectedRows([])
  }

  const convertToCSV = (data, columns) => {
    if (!data || data.length === 0) return '';

    const columnHeaders = columns
      .filter(col => col.title !== 'Sr No.')
      .map(col => col.id);

    const csvRows = [
      // Header Row
      ['Sr No.', ...columns.filter(col => col.title !== 'Sr No.').map(col => col.title)].join(','),
      // Data Rows
      ...data.map((row, index) =>
        [
          index + 1,
          ...columnHeaders.map(field => {
            let value = row[field];
            if (field === 'dueDate') {
              value = formatDueDate(value);
            }
            if (value == null) {
              value = '';
            }
            value = value.toString().replace(/"/g, '""');
            return `"${value}"`;
          })
        ].join(',')
      )
    ];

    return csvRows.join('\n');
  };

  const handleExportCsv = () => {
    const csvData = convertToCSV(filteredResults, columns);
    downloadCSV(csvData, 'filteredData.csv');
  };

  const downloadCSV = (csvData, filename = 'data.csv') => {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  

const handleImportCompany = async () => {
  if (!file) {
    toast.error('No file selected.');
    return;
  }

  if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
    toast.error('Invalid file type. Please upload a CSV file.');
    return;
  }

  // Initialize the rate limiter
  const limiter = new Bottleneck({
    reservoir: 1000, // Number of requests per reservoir refresh
    reservoirRefreshAmount: 1000,
    reservoirRefreshInterval: 60 * 1000, // Refresh every minute
    maxConcurrent: 20,
    minTime: 60 // Minimum time between requests in milliseconds
  });

  limiter.on('error', (err) => console.error(`Rate limit error: ${err.message}`));

  // Function to check the Shopify API rate limit and throttle if necessary
  async function checkAndThrottle(response) {
    const callLimitHeader = response.headers['x-shopify-shop-api-call-limit'];
    if (callLimitHeader) {
      const [currentCalls, callLimit] = callLimitHeader.split('/').map(Number);
      const remainingCalls = callLimit - currentCalls;

      if (remainingCalls < 10) { // Threshold for remaining calls
        console.warn('Approaching Shopify API rate limit. Throttling requests.');
        // Pause until the rate limit resets
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
      }
    }
  }

  // Function to parse and validate the due date
  function parseDueDate(dueDateInput) {
    let dueDate;
    if (!isNaN(Number(dueDateInput))) {
      // Assume Unix timestamp in seconds
      dueDate = new Date(Number(dueDateInput) * 1000);
    } else {
      // Attempt to parse date string
      dueDate = new Date(dueDateInput);
    }

    if (isNaN(dueDate.getTime())) {
      throw new Error(`Invalid due date: ${dueDateInput}`);
    }

    return dueDate.toISOString();
  }

  // Function to send an API request with Shopify rate limit handling
  async function createCompany(formObject) {
    return limiter.schedule(async () => {
      try {
        const response = await axios.post(`${serverUrl}/api/create-company`, formObject, {
          headers: { 'Content-Type': 'application/json' }
        });

        await checkAndThrottle(response); // Adjust based on rate limits

        if (response.status >= 200 && response.status < 300) {
          console.log(`Company created for email: ${formObject.customerEmail}`);
          return { success: true, email: formObject.customerEmail };
        } else if (response.status === 409) { // Conflict, possibly already exists
          console.warn(`Company already exists for email: ${formObject.customerEmail}`);
          return { success: false, email: formObject.customerEmail, skipped: true };
        } else {
          console.error(`Failed to create company for email: ${formObject.customerEmail}`);
          return { success: false, email: formObject.customerEmail };
        }
      } catch (error) {
        console.error(`Error in sending form data for ${formObject.customerEmail}:`, error.message);
        return { success: false, email: formObject.customerEmail, error };
      }
    });
  }

  // Function to process entries in batches
  async function processEntries(data) {
    const chunkSize = 100; // Adjust based on testing and performance
    let createdCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const promises = chunk.map((entry) => {
        const formObject = {
          customerEmail: entry.customerEmail,
          firstName: entry.firstName,
          lastName: entry.lastName,
          countryCode: entry.countryCode,
          dueDate: entry.dueDate,
          relationship: entry.relationship
        };

        return createCompany(formObject);
      });

      const results = await Promise.allSettled(promises);

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.success) {
          createdCount++;
        } else if (result.value && result.value.skipped) {
          skippedCount++;
        } else {
          failedCount++;
        }
      });

      // Optional: Provide progress feedback
      console.log(`Processed ${Math.min(i + chunkSize, data.length)} of ${data.length} entries.`);
    }

    // Provide a detailed report to the user
    toast.success(`${createdCount} companies created.`);
    if (skippedCount > 0) {
      toast.info(`${skippedCount} entries skipped (existing customers).`);
    }
    if (failedCount > 0) {
      toast.error(`${failedCount} requests failed.`);
    }

    console.log(`Import Summary: ${createdCount} companies created, ${skippedCount} skipped, ${failedCount} failed.`);
  }

  // Parse CSV and process data
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async (results) => {
      const data = results.data;

      if (!Array.isArray(data) || data.length === 0) {
        toast.error('Invalid CSV data or no data found.');
        return;
      }

      // Perform comprehensive validation
      const requiredFields = ['customerEmail', 'firstName', 'lastName', 'countryCode', 'dueDate', 'relationship'];
      const invalidRows = [];

      data.forEach((entry, index) => {
        const missingFields = requiredFields.filter(field => !entry[field]);
        if (missingFields.length > 0 || !entry.customerEmail.includes('@')) {
          invalidRows.push({ index: index + 2, missingFields }); // +2 accounts for header row and zero-based index
        }
      });

      if (invalidRows.length > 0) {
        const errorMessage = invalidRows.map(row =>
          `Row ${row.index}: Missing or invalid fields - ${row.missingFields.join(', ')}`
        ).join('\n');

        toast.error(`CSV contains invalid data:\n${errorMessage}`);
        return;
      }

      try {
        await processEntries(data); // Process all entries
      } catch (error) {
        toast.error('An error occurred during processing.');
        console.error('Processing error:', error);
      }
    },
    error: (error) => {
      toast.error('Error parsing CSV file.');
      console.error('Error parsing CSV file:', error);
    }
  });
};

  



  // Function to check customer status by email
  const checkCustomerByEmail = async (email) => {
    try {
      const response = await fetch(`${serverUrl}/api/get-company-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email }),
      });
      const data = await response.json();
      return response.status; // Assuming response status indicates the result
    } catch (error) {
      console.log('Error fetching customer data:', error);
      return null;
    }
  };

  // function to convert the Unix timestamp (in seconds) to a human-readable date format.
  const formatDueDate = (timestamp) => {
    if (isNaN(timestamp)) return 'NA';
    const date = new Date(timestamp * 1000);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  function getNext12Months() {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const currentDate = new Date();
    const next12Months = [];

    for (let i = 0; i < 12; i++) {
      const currentMonth = currentDate.getMonth() + i;
      const monthIndex = currentMonth % 12;
      const year = currentDate.getFullYear() + Math.floor(currentMonth / 12);

      next12Months.push({
        value: `${months[monthIndex].toLowerCase()}_${year}`,
        label: `${months[monthIndex]} ${year}`
      });
    }

    return next12Months;
  }

  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={2000}
        theme="light"
      />

      <div className="container-fluid customer-container">
        <div className="card card-block border-0 customer-table-css-main">
          <div className="card-body p-0">
            <div className="p-3 bg-light add-cutomer-section">
              <div className="row mb-2">
                <div className="col-lg-12">
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                      <span><Diversity3OutlinedIcon sx={{ fontSize: "35px" }} /></span>
                      <span>
                        <h5 className="mb-0">Members</h5>
                      </span>
                    </div>
                    <div className="searchParentWrapper">
                      <div className="input-group">
                        <input
                          type="text"
                          className="form-control bg-custom border-end-0 search-input"
                          placeholder="Search Customer"
                          onChange={(e) => searchItems(e.target.value)}
                        />
                        <div className="input-group-append">
                          <button
                            className="btn border border-start-0 search-icon-custom"
                            type="button"
                            style={{ height: '100%' }}
                          >
                            <i className="fa fa-search"></i>
                          </button>
                        </div>
                      </div>
                      <div className="d-flex">
                        <div>
                          <input type="file" accept=".csv" onChange={handleFileChange} className="importCompany" />
                          <button
                            className="btn btn-primary"
                            onClick={handleImportCompany}
                          >
                            <i className="fas fa-file-export me-1"></i> Import Data
                          </button>
                        </div>
                        <button
                          className="btn btn-primary ms-2"
                          onClick={handleExportCsv}
                        >
                          <i className="fas fa-file-export me-1"></i> Export Csv
                        </button>
                        {/* <button
                        className="btn btn-primary add-customer-btn ms-2" onClick={deleteRowFromTable}>
                        <i className="fa fa-trash"></i>
                      </button> */}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="row">
                <div className="col-lg-12">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <span className="no-of-item me-3">{filteredResults.length} Items</span>
                    </div>
                    <div>
                      <div className="d-flex gap-2">
                        <div className="input-group">
                          <label style={{ display: "flex", alignItems: "center", marginRight: "10px" }}>From</label>
                          <input
                            type="date"
                            className="form-control bg-custom"
                            value={filterOptions.dateFrom}
                            onChange={(e) => setFilterOptions({ ...filterOptions, dateFrom: e.target.value })}
                          />
                        </div>
                        <div className="input-group">
                          <label style={{ display: "flex", alignItems: "center", margin: "0 10px" }}>To</label>
                          <input
                            type="date"
                            className="form-control bg-custom"
                            value={filterOptions.dateTo}
                            onChange={(e) => setFilterOptions({ ...filterOptions, dateTo: e.target.value })}
                          />
                        </div>
                        <div>
                          <Select
                            sx={{ minWidth: "150px" }}
                            labelId=""
                            id="relationship-select-small"
                            value={filterOptions.relationship}
                            onChange={(e) => { setFilterOptions({ ...filterOptions, relationship: e.target.value }) }}
                          >
                            <MenuItem value="null" disabled>Relationship</MenuItem>
                            <MenuItem value="father">Father</MenuItem>
                            <MenuItem value="mother">Mother</MenuItem>
                            <MenuItem value="grandparent">Grandparent</MenuItem>
                            <MenuItem value="friend">Friend</MenuItem>
                            <MenuItem value="other">Other</MenuItem>
                          </Select>
                        </div>
                        <div>
                          <Select
                            sx={{ minWidth: "175px" }}
                            labelId=""
                            id="dueDate-select-small"
                            value={filterOptions.filterMonth}
                            onChange={(e) => { setFilterOptions({ ...filterOptions, filterMonth: e.target.value }) }}
                          >
                            <MenuItem value="null" disabled>Month</MenuItem>
                            {getNext12Months().map((month) => (
                              <MenuItem key={month.value} value={month.value}>
                                {month.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <button
                            className="btn btn-primary ml-3 text-nowrap"
                            type="button"
                            onClick={handleResetFilter}
                          >
                            Reset Filter
                          </button>
                        </div>
                        <div className="dropdown">
                          <button
                            className="btn btn-primary ml-3 dropdown-toggle text-nowrap"
                            type="button"
                            id="dropdownMenuButton"
                            data-bs-toggle="dropdown"
                            aria-expanded="false"
                            style={{ height: '100%' }}
                          >
                            <i className="fas fa-plus me-2"></i> Add Column
                          </button>
                          <ul className="dropdown-menu addCol" aria-labelledby="dropdownMenuButton">
                            {apiKeys.map((key) => (
                              !["companyId", "locationId", "companyRoleId", "companyContactId"].includes(key) && ( // Only render if key is not "firstName"
                                <li key={key}>
                                  <label className="dropdown-item">
                                    <input
                                      type="checkbox"
                                      onChange={() => handleToggleColumn(key)}
                                      checked={columns.some(column => column.id === key)}
                                    /> {key}
                                  </label>
                                </li>
                              )
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="table-responsive customerTable">
              <DragDropContext onDragEnd={onDragEnd}>
                <table className="table text-start customer-table-css">
                  <thead ref={tableHeaderRef}>
                    <Droppable droppableId="columns" direction="horizontal">
                      {(provided) => (
                        <tr ref={provided.innerRef} {...provided.droppableProps}>
                          {columns.map((column, index) => (
                            <Draggable
                              key={column.id}
                              draggableId={column.id}
                              index={index}
                              isDragDisabled={index === 0 || index === 1}
                            >
                              {(provided) => (
                                <th
                                  key={column.id}
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className="text-center"
                                >
                                  <ResizableBox
                                    width={columnWidths[column.id] || 100}
                                    height={23}
                                    axis="x"
                                    minConstraints={[10, 30]}
                                    maxConstraints={[2000, 23]}
                                    resizeHandles={["e"]}
                                    className="resize-handle"
                                    onResizeStop={(e, data) => handleResize(column.id, data.size.width)}
                                  >
                                    <div {...(index !== 0 && index !== 1 ? provided.dragHandleProps : {})}>
                                      {column.id === 'selectAll' ? (
                                        <input
                                          type="checkbox"
                                          checked={selectAll}
                                          onChange={handleSelectAll}
                                        />
                                      ) : (
                                        <div className="d-flex align-items-center gap-2 justify-content-between">
                                          <span className="truncate-text" title={column.title}>{column.title}</span>
                                          {column.id !== 'serialNumber' && (
                                            <div className="ml-2 sortable-header" onClick={() => handleSort(column.id)}>
                                              <i className={`fas ${sortConfig.key === column.id && sortConfig.direction === 'ascending' ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </ResizableBox>
                                </th>
                              )}
                            </Draggable>
                          ))}
                          {provided?.placeholder}
                        </tr>
                      )}
                    </Droppable>
                  </thead>
                  <tbody>
                    {currentRows.length > 0 ? (
                      currentRows.map((row, rowIndex) => (
                        <tr key={row.id} onClick={(e) => {
                          const target = e.target;
                          const isCheckbox = target.tagName.toLowerCase() === 'input' && target.type === 'checkbox';
                          if (!isCheckbox) {
                            setViewingCustomer(row);
                          }
                        }} style={{ cursor: "pointer" }}>
                          {columns.map((column) => {
                            if (column.id === 'serialNumber') {
                              return (
                                <td key={column.id}>{indexOfFirstRow + rowIndex + 1}</td>
                              );
                            } else if (column.id === 'selectAll') {
                              return (
                                <td key={column.id}>
                                  <input
                                    type="checkbox"
                                    checked={selectedRows.includes(row._id)}
                                    onChange={() => handleSelectRow(row._id)}
                                  />
                                </td>
                              );
                            } else {
                              return (
                                <td key={column.id} >
                                  {row[column.id] && typeof row[column.id] === 'object' ? (
                                    <div>
                                      {column.id === 'address' && (
                                        <div>
                                          <div>Street: {row[column.id].street}</div>
                                          <div>Suite: {row[column.id].suite}</div>
                                          <div>City: {row[column.id].city}</div>
                                          <div>Zipcode: {row[column.id].zipcode}</div>
                                        </div>
                                      )}
                                      {column.id === 'company' && (
                                        <div>
                                          <div>Name: {row[column.id].name}</div>
                                          <div>Catch Phrase: {row[column.id].catchPhrase}</div>
                                          <div>Business: {row[column.id].bs}</div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className={column.id}> {column.id === 'dueDate' ? formatDueDate(row[column.id]) : row[column.id]} </span>
                                  )}
                                </td>
                              );
                            }
                          })}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={columns.length} className="text-center">
                          No results found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </DragDropContext>
            </div>

            {/* pagination */}
      {/* pagination */}
{filteredResults.length > 0 && (
  <nav className="mt-3">
    <ul className="customer-pagination pagination justify-content-center">
      <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
        <button className="page-link" onClick={handlePrevPage}>
          <i className="fa fa-chevron-left"></i>
        </button>
      </li>

      {/* Generate page numbers */}
      {getPageNumbers().map((pageNumber, index) => (
        <li
          key={index}
          className={`page-item ${
            pageNumber === currentPage ? 'active' : ''
          } ${pageNumber === '...' ? 'disabled' : ''}`}
        >
          {pageNumber === '...' ? (
            <span className="page-link">...</span>
          ) : (
            <button
              className="page-link"
              onClick={() => {
                setCurrentPage(pageNumber);
                window.scrollTo({
                  top: tableHeaderRef.current.offsetTop,
                  behavior: 'smooth',
                });
              }}
            >
              {pageNumber}
            </button>
          )}
        </li>
      ))}

      <li
        className={`page-item ${
          currentPage === totalPages ? 'disabled' : ''
        }`}
      >
        <button className="page-link" onClick={handleNextPage}>
          <i className="fa fa-chevron-right"></i>
        </button>
      </li>
    </ul>
  </nav>
)}


          </div>
        </div>
      </div>
    </>
  )
}

export default Member;
