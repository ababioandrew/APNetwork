import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import "./MembersDashboard.css";
import { useNavigate } from "react-router-dom";


// =====================================================
// INITIAL FORM DATA
// =====================================================

const initialFormData = {
  fullName: "",
  gender: "",
  location: "",
  dateOfBirth: "",
  dateOfEntry: "",
  contacts: "",
  remarks: "",
};


// =====================================================
// API CONFIGURATION
// =====================================================
//
// LOCAL DEVELOPMENT:
//
// React:
// http://localhost:3000
//
// Express:
// http://localhost:5000
//
// Set in .env:
//
// REACT_APP_API_URL=http://localhost:5000
//
// PRODUCTION:
//
// Set in Vercel:
//
// REACT_APP_API_URL=https://your-domain.vercel.app
//
// If REACT_APP_API_URL is not provided, the
// relative /api path is used. This is useful when
// React and Express are hosted under the same domain.
// =====================================================

const API_BASE_URL = (
  process.env.REACT_APP_API_URL || ""
).replace(/\/+$/, "");


// =====================================================
// API HELPER
// =====================================================

const fetchJSON = async (endpoint, options = {}) => {

  const cleanEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  const url = `${API_BASE_URL}/api${cleanEndpoint}`;

  console.log("====================================");
  console.log("API REQUEST");
  console.log("URL:", url);
  console.log("Method:", options.method || "GET");
  console.log("====================================");

  try {

    const response = await fetch(url, {
      ...options,

      headers: {
        Accept: "application/json",

        ...(options.body
          ? {
              "Content-Type":
                "application/json",
            }
          : {}),

        ...(options.headers || {}),
      },
    });


    // =================================================
    // READ RESPONSE ONCE
    // =================================================

    const contentType =
      response.headers.get("content-type") || "";

    const responseText =
      await response.text();


    console.log(
      "API STATUS:",
      response.status
    );

    console.log(
      "API CONTENT TYPE:",
      contentType
    );


    // =================================================
    // EMPTY RESPONSE
    // =================================================

    if (!responseText.trim()) {

      throw new Error(
        `Server returned an empty response. Status: ${response.status}`
      );
    }


    // =================================================
    // TRY TO PARSE JSON
    // =================================================

    let data = null;

    if (
      contentType
        .toLowerCase()
        .includes("application/json")
    ) {

      try {

        data = JSON.parse(responseText);

      } catch (parseError) {

        console.error(
          "❌ Invalid JSON response:",
          responseText
        );

        throw new Error(
          `Server returned invalid JSON. Status: ${response.status}`
        );
      }

    } else {

      // =================================================
      // NON-JSON RESPONSE
      // =================================================

      console.error(
        "❌ Non-JSON response from backend:",
        responseText.substring(0, 1000)
      );

      if (response.status === 404) {

        throw new Error(
          `API route not found: ${url}`
        );
      }

      if (response.status === 500) {

        throw new Error(
          "Server error (500). Check the backend and database connection."
        );
      }

      throw new Error(
        `Expected JSON but received ${contentType || "unknown content type"}. Status: ${response.status}`
      );
    }


    // =================================================
    // HTTP ERROR
    // =================================================

    if (!response.ok) {

      const serverMessage =
        data?.message ||
        data?.error ||
        data?.details ||
        `Request failed with status ${response.status}`;

      throw new Error(serverMessage);
    }


    return data;

  } catch (error) {

    console.error(
      "❌ API request error:",
      error
    );


    if (
      error.name === "TypeError" &&
      error.message.includes("fetch")
    ) {

      throw new Error(
        "Cannot connect to the backend server. Please ensure the backend is running."
      );
    }


    throw error;
  }
};


// =====================================================
// MEMBERS DASHBOARD
// =====================================================

const MembersDashboard = () => {

  const navigate = useNavigate();


  // =====================================================
  // STATE
  // =====================================================

  const [members, setMembers] =
    useState([]);

  const [formData, setFormData] =
    useState(initialFormData);

  const [selectedMember, setSelectedMember] =
    useState(null);

  const [loadingMembers, setLoadingMembers] =
    useState(false);

  const [loadingHealth, setLoadingHealth] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState(null);

  const [backendStatus, setBackendStatus] =
    useState(null);

  const [enquiry, setEnquiry] =
    useState("");

  const [sendingEnquiry, setSendingEnquiry] =
    useState(false);


  // =====================================================
  // CHECK BACKEND HEALTH
  // =====================================================

  const checkHealth = async () => {

    setLoadingHealth(true);

    try {

      const result =
        await fetchJSON("/health");

      setBackendStatus(result);

    } catch (error) {

      console.error(
        "❌ Health check error:",
        error
      );

      setBackendStatus({
        success: false,
        message:
          "Backend is not reachable.",
        error: error.message,
      });

    } finally {

      setLoadingHealth(false);
    }
  };


  // =====================================================
  // GET MEMBERS
  // =====================================================

  const fetchMembers = async () => {

    setLoadingMembers(true);

    try {

      const result =
        await fetchJSON("/members");


      // =================================================
      // SUPPORT DIFFERENT BACKEND RESPONSE FORMATS
      // =================================================

      let memberList = [];


      if (Array.isArray(result)) {

        memberList = result;

      } else if (
        Array.isArray(result?.members)
      ) {

        memberList = result.members;

      } else if (
        Array.isArray(result?.data)
      ) {

        memberList = result.data;

      } else {

        console.error(
          "Unexpected members response:",
          result
        );

        throw new Error(
          "Invalid members response from server."
        );
      }


      // =================================================
      // NORMALIZE DATABASE FIELD NAMES
      // =================================================

      const normalizedMembers =
        memberList.map((member) => ({

          ...member,

          fullName:
            member.fullName ??
            member.fullname ??
            "",

          dateOfBirth:
            member.dateOfBirth ??
            member.dateofbirth ??
            "",

          dateOfEntry:
            member.dateOfEntry ??
            member.dateofentry ??
            "",

          createdAt:
            member.createdAt ??
            member.createdat ??
            "",

          updatedAt:
            member.updatedAt ??
            member.updatedat ??
            "",
        }));


      setMembers(
        normalizedMembers
      );

    } catch (error) {

      console.error(
        "❌ GET members error:",
        error
      );

      setMembers([]);

      Swal.fire({
        icon: "error",
        title: "Unable to Load Members",
        text:
          error.message ||
          "Unable to load members.",
        confirmButtonColor: "#04732d",
      });

    } finally {

      setLoadingMembers(false);
    }
  };


  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {

    checkHealth();

    fetchMembers();

  }, []);


  // =====================================================
  // HANDLE INPUT
  // =====================================================

  const handleChange = (e) => {

    const {
      name,
      value,
    } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };


  // =====================================================
  // EDIT MEMBER
  // =====================================================

  const handleEdit = (member) => {

    setSelectedMember(member);

    setFormData({

      fullName:
        member.fullName || "",

      gender:
        member.gender || "",

      location:
        member.location || "",

      dateOfBirth:
        member.dateOfBirth
          ? String(
              member.dateOfBirth
            ).substring(0, 10)
          : "",

      dateOfEntry:
        member.dateOfEntry
          ? String(
              member.dateOfEntry
            ).substring(0, 10)
          : "",

      contacts:
        member.contacts || "",

      remarks:
        member.remarks || "",
    });


    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };


  // =====================================================
  // CANCEL EDIT
  // =====================================================

  const handleCancelEdit = () => {

    setSelectedMember(null);

    setFormData(
      initialFormData
    );
  };


  // =====================================================
  // UPDATE MEMBER
  // =====================================================

  const handleUpdate = async (e) => {

    e.preventDefault();


    if (!selectedMember) {
      return;
    }


    if (
      !formData.fullName.trim() ||
      !formData.gender ||
      !formData.dateOfEntry
    ) {

      Swal.fire({
        icon: "warning",
        title: "Incomplete Form",
        text:
          "Full name, gender and date of entry are required.",
        confirmButtonColor: "#04732d",
      });

      return;
    }


    setSaving(true);


    const payload = {

      fullName:
        formData.fullName.trim(),

      gender:
        formData.gender,

      location:
        formData.location.trim(),

      dateOfBirth:
        formData.dateOfBirth || null,

      dateOfEntry:
        formData.dateOfEntry,

      contacts:
        formData.contacts.trim(),

      remarks:
        formData.remarks.trim(),
    };


    try {

      const result =
        await fetchJSON(
          `/members/${selectedMember.id}`,
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body:
              JSON.stringify(payload),
          }
        );


      Swal.fire({
        icon: "success",
        title: "Member Updated",
        text:
          result.message ||
          "Member updated successfully!",
        confirmButtonColor: "#04732d",
      });


      setSelectedMember(null);

      setFormData(
        initialFormData
      );


      await fetchMembers();

    } catch (error) {

      console.error(
        "PUT member error:",
        error
      );

      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text:
          error.message ||
          "Failed to update member.",
        confirmButtonColor: "#d33",
      });

    } finally {

      setSaving(false);
    }
  };


  // =====================================================
  // DELETE MEMBER
  // =====================================================

  const handleDelete = async (id) => {

    const member =
      members.find(
        (item) => item.id === id
      );


    const confirmation =
      await Swal.fire({

        icon: "warning",

        title: "Delete Member?",

        text: member
          ? `Are you sure you want to delete ${member.fullName}?`
          : "Are you sure you want to delete this member?",

        showCancelButton: true,

        confirmButtonColor: "#d33",

        cancelButtonColor: "#6c757d",

        confirmButtonText:
          "Yes, Delete",

        cancelButtonText:
          "Cancel",
      });


    if (!confirmation.isConfirmed) {
      return;
    }


    setDeletingId(id);


    try {

      const result =
        await fetchJSON(
          `/members/${id}`,
          {
            method: "DELETE",

            headers: {
              Accept:
                "application/json",
            },
          }
        );


      Swal.fire({
        icon: "success",
        title: "Deleted",
        text:
          result.message ||
          "Member deleted successfully!",
        confirmButtonColor: "#04732d",
      });


      setMembers((prev) =>
        prev.filter(
          (member) =>
            member.id !== id
        )
      );


      if (
        selectedMember?.id === id
      ) {

        handleCancelEdit();
      }

    } catch (error) {

      console.error(
        "DELETE member error:",
        error
      );

      Swal.fire({
        icon: "error",
        title: "Delete Failed",
        text:
          error.message ||
          "Failed to delete member.",
        confirmButtonColor: "#d33",
      });

    } finally {

      setDeletingId(null);
    }
  };


  // =====================================================
  // SEND ENQUIRY
  // =====================================================

  const handleSendEnquiry = async (e) => {

    e.preventDefault();


    if (!enquiry.trim()) {

      Swal.fire({
        icon: "warning",
        title: "Message Required",
        text:
          "Please enter an enquiry message.",
        confirmButtonColor: "#04732d",
      });

      return;
    }


    setSendingEnquiry(true);


    try {

      const result =
        await fetchJSON(
          "/send-enquiry",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body:
              JSON.stringify({
                message:
                  enquiry.trim(),
              }),
          }
        );


      // =================================================
      // WHATSAPP
      // =================================================

      const whatsappNumber =
        "233548099730";


      const whatsappMessage =
        encodeURIComponent(

          result.whatsappCaption ||

          `🔔 NEW CHURCH WEBSITE ENQUIRY

${enquiry.trim()}

📍 Source: Church Website`
        );


      const whatsappUrl =
        `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;


      window.open(
        whatsappUrl,
        "_blank",
        "noopener,noreferrer"
      );


      Swal.fire({
        icon: "success",
        title: "Enquiry Sent",
        text:
          "The enquiry was sent by email and WhatsApp has been opened with the message ready to send.",
        confirmButtonColor: "#04732d",
      });


      setEnquiry("");

    } catch (error) {

      console.error(
        "Send enquiry error:",
        error
      );

      Swal.fire({
        icon: "error",
        title: "Failed to Send",
        text:
          error.message ||
          "Failed to send enquiry.",
        confirmButtonColor: "#d33",
      });

    } finally {

      setSendingEnquiry(false);
    }
  };


  // =====================================================
  // FORMAT DATE
  // =====================================================

  const formatDate = (date) => {

    if (!date) {
      return "-";
    }

    return String(date)
      .substring(0, 10);
  };


  // =====================================================
  // RENDER
  // =====================================================

  return (

    <div className="members-dashboard">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="dashboard-header">

        <div>

          <h1>
            Members Management
          </h1>

          <p>
            View, update and manage church members.
          </p>

        </div>


        <button
          className="refresh-btn"
          onClick={() => {
            checkHealth();
            fetchMembers();
          }}
        >
          ↻ Refresh
        </button>

      </div>


      {/* =================================================
          HEALTH
      ================================================= */}

      <section className="dashboard-card health-card">

        <div className="section-heading">

          <h2>
            Backend & Database Status
          </h2>

        </div>


        {loadingHealth ? (

          <div className="status-loading">
            Checking backend...
          </div>

        ) : backendStatus?.success ? (

          <div className="health-success">

            <span className="status-dot"></span>

            <div>

              <strong>
                Backend Online
              </strong>

              <p>
                {backendStatus.message}
              </p>

              {backendStatus.database && (
                <small>
                  Database:{" "}
                  {backendStatus.database}
                </small>
              )}

            </div>

          </div>

        ) : (

          <div className="health-error">

            <span className="status-dot"></span>

            <div>

              <strong>
                Backend Offline
              </strong>

              <p>
                {backendStatus?.message ||
                  "Unable to connect to backend."}
              </p>

            </div>

          </div>

        )}

      </section>


      {/* =================================================
          EDIT MEMBER
      ================================================= */}

      {selectedMember && (

        <section className="dashboard-card edit-card">

          <div className="section-heading">

            <div>

              <h2>
                Edit Member
              </h2>

              <p>
                Member ID:{" "}
                {selectedMember.id}
              </p>

            </div>


            <button
              type="button"
              className="cancel-btn"
              onClick={
                handleCancelEdit
              }
            >
              Cancel
            </button>

          </div>


          <form
            className="member-edit-form"
            onSubmit={handleUpdate}
          >

            <div className="form-group">

              <label>
                Full Name
              </label>

              <input
                type="text"
                name="fullName"
                value={
                  formData.fullName
                }
                onChange={
                  handleChange
                }
                placeholder="Enter full name"
              />

            </div>


            <div className="form-group">

              <label>
                Gender
              </label>

              <select
                name="gender"
                value={
                  formData.gender
                }
                onChange={
                  handleChange
                }
              >

                <option value="">
                  Select Gender
                </option>

                <option value="Male">
                  Male
                </option>

                <option value="Female">
                  Female
                </option>

                <option value="Other">
                  Other
                </option>

              </select>

            </div>


            <div className="form-group">

              <label>
                Location
              </label>

              <input
                type="text"
                name="location"
                value={
                  formData.location
                }
                onChange={
                  handleChange
                }
                placeholder="Enter location"
              />

            </div>


            <div className="form-group">

              <label>
                Date Of Birth
              </label>

              <input
                type="date"
                name="dateOfBirth"
                value={
                  formData.dateOfBirth
                }
                onChange={
                  handleChange
                }
              />

            </div>


            <div className="form-group">

              <label>
                Date Of Entry
              </label>

              <input
                type="date"
                name="dateOfEntry"
                value={
                  formData.dateOfEntry
                }
                onChange={
                  handleChange
                }
              />

            </div>


            <div className="form-group">

              <label>
                Contacts
              </label>

              <input
                type="tel"
                name="contacts"
                value={
                  formData.contacts
                }
                onChange={
                  handleChange
                }
                placeholder="Enter contact"
              />

            </div>


            <div className="form-group full-width">

              <label>
                Remarks
              </label>

              <textarea
                name="remarks"
                value={
                  formData.remarks
                }
                onChange={
                  handleChange
                }
                placeholder="Enter remarks"
                rows="4"
              />

            </div>


            <div className="form-actions">

              <button
                type="button"
                className="cancel-btn"
                onClick={
                  handleCancelEdit
                }
              >
                Cancel
              </button>


              <button
                type="submit"
                className="save-btn"
                disabled={saving}
              >
                {saving
                  ? "Updating..."
                  : "Update Member"}
              </button>

            </div>

          </form>

        </section>

      )}


      {/* =================================================
          MEMBERS
      ================================================= */}

      <section className="dashboard-card members-card">

        <div className="section-heading">

          <div>

            <h2>
              Members
            </h2>

            <p>
              Total Members:{" "}
              <strong>
                {members.length}
              </strong>
            </p>

          </div>


          <button
            type="button"
            className="refresh-btn"
            onClick={() =>
              navigate("/FullDetails")
            }
          >
            Add Member
          </button>

        </div>


        {loadingMembers ? (

          <div className="table-message">
            Loading members...
          </div>

        ) : members.length === 0 ? (

          <div className="table-message">
            No members found.
          </div>

        ) : (

          <div className="table-wrapper">

            <table className="members-table">

              <thead>

                <tr>

                  <th>
                    ID
                  </th>

                  <th>
                    Full Name
                  </th>

                  <th>
                    Gender
                  </th>

                  <th>
                    Location
                  </th>

                  <th>
                    Date Of Birth
                  </th>

                  <th>
                    Date Of Entry
                  </th>

                  <th>
                    Contacts
                  </th>

                  <th>
                    Remarks
                  </th>

                  <th>
                    Actions
                  </th>

                </tr>

              </thead>


              <tbody>

                {members.map(
                  (member) => (

                    <tr
                      key={
                        member.id
                      }
                    >

                      <td>
                        {member.id}
                      </td>

                      <td className="member-name">
                        {
                          member.fullName ||
                          "-"
                        }
                      </td>

                      <td>
                        {
                          member.gender ||
                          "-"
                        }
                      </td>

                      <td>
                        {
                          member.location ||
                          "-"
                        }
                      </td>

                      <td>
                        {formatDate(
                          member.dateOfBirth
                        )}
                      </td>

                      <td>
                        {formatDate(
                          member.dateOfEntry
                        )}
                      </td>

                      <td>
                        {
                          member.contacts ||
                          "-"
                        }
                      </td>

                      <td className="remarks-cell">
                        {
                          member.remarks ||
                          "-"
                        }
                      </td>


                      <td>

                        <div className="action-buttons">

                          <button
                            className="edit-btn"
                            onClick={() =>
                              handleEdit(
                                member
                              )
                            }
                          >
                            Edit
                          </button>


                          <button
                            className="delete-btn"
                            onClick={() =>
                              handleDelete(
                                member.id
                              )
                            }
                            disabled={
                              deletingId ===
                              member.id
                            }
                          >

                            {deletingId ===
                            member.id
                              ? "Deleting..."
                              : "Delete"}

                          </button>

                        </div>

                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        )}

      </section>


      {/* =================================================
          ENQUIRY
      ================================================= */}

      <section className="dashboard-card enquiry-card">

        <div className="section-heading">

          <div>

            <h2>
              Send Enquiry
            </h2>

            <p>
              Share your candid opinion of ideas
              to improve church growth.
            </p>

          </div>

        </div>


        <form
          onSubmit={
            handleSendEnquiry
          }
        >

          <div className="form-group">

            <label htmlFor="enquiry">
              Message
            </label>

            <textarea
              id="enquiry"
              value={enquiry}
              onChange={(e) =>
                setEnquiry(
                  e.target.value
                )
              }
              placeholder="Enter your enquiry..."
              rows="5"
            />

          </div>


          <button
            type="submit"
            className="send-btn"
            disabled={
              sendingEnquiry
            }
          >

            {sendingEnquiry
              ? "Sending..."
              : "Send Enquiry"}

          </button>

        </form>

      </section>

    </div>
  );
};


export default MembersDashboard;