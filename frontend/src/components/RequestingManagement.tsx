/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  DatePicker,
  Tag,
} from "antd";
import axios from "axios";
import dayjs from "dayjs";

const { Option } = Select;

// Interfaces
interface Parcel {
  PID: number;
  ParcelName: string;
  Quantity: number;
}

interface Staff {
  StaffID: number;
  FirstName: string;
  LastName: string;
}

interface Status {
  Status_ID: number;
  Status: string;
}

interface Requesting {
  Requesting_ID: number;
  Requesting_NO: string;
  PID?: number;
  Parcel?: Parcel;
  StaffID?: number;
  Staff?: Staff;
  Amount_Request: number;
  Request_Date: string;
  Status_ID?: number;
  Status?: Status;
}

const API_URL = "http://localhost:8088/api";

const RequestingManagement: React.FC = () => {
  // States
  const [requestings, setRequestings] = useState<Requesting[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRequesting, setEditingRequesting] = useState<Requesting | null>(
    null
  );
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [form] = Form.useForm();
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [requestingsRes, parcelsRes, staffsRes, statusesRes] =
        await Promise.all([
          axios.get(`${API_URL}/requestings`),
          axios.get(`${API_URL}/parcels`),
          axios.get(`${API_URL}/staffs`),
          axios.get(`${API_URL}/statuses`),
        ]);
      setRequestings(requestingsRes.data || []);
      setParcels(parcelsRes.data || []);
      setStaffs(staffsRes.data || []);
      setStatuses(statusesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      message.error("ไม่สามารถโหลดข้อมูลได้");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API_URL}/requestings/${id}`);
      message.success("ลบคำร้องสำเร็จ");
      setRequestings((prev) => prev.filter((req) => req.Requesting_ID !== id));
    } catch (error) {
      console.error("Error deleting requesting:", error);
      message.error("ไม่สามารถลบคำร้องได้");
    }
  };

  const showModal = (record?: Requesting) => {
    setEditingRequesting(record || null);
    setIsModalVisible(true);
    if (record) {
      form.setFieldsValue({
        PID: record.PID,
        Staff_ID: record.StaffID,
        Amount_Request: record.Amount_Request,
        Request_Date: record.Request_Date ? dayjs(record.Request_Date) : null,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ Request_Date: dayjs() });
    }
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const createPayload = {
        PID: values.PID,
        Amount_Request: parseInt(values.Amount_Request, 10),
        Staff_ID: values.Staff_ID,
        Request_Date: values.Request_Date.format("YYYY-MM-DD"),
      };
      await axios.post(`${API_URL}/requestings`, createPayload);
      message.success("สร้างคำร้องสำเร็จ");
      setIsModalVisible(false);
      await fetchData(); // ดึงใหม่ให้ได้ความสัมพันธ์ Parcel/Staff/Status ครบ
    } catch (error) {
      console.error("Error creating requesting:", error);
      const errorMessage =
        (error as any).response?.data?.error || "ไม่สามารถสร้างคำร้องได้";
      message.error(errorMessage);
    }
  };

  const handleStatusUpdate = async (newStatusId: number) => {
    if (!editingRequesting) return;
    setIsSubmittingStatus(true);
    try {
      const id = editingRequesting.Requesting_ID;
      const payload = { Status_ID: newStatusId };
      await axios.put(`${API_URL}/requestings/${id}/status`, payload);
      message.success("อัปเดตสถานะสำเร็จ");
      const newStatusObject = statuses.find((s) => s.Status_ID === newStatusId);
      setRequestings((prev) =>
        prev.map((req) =>
          req.Requesting_ID === id
            ? { ...req, Status_ID: newStatusId, Status: newStatusObject }
            : req
        )
      );
      setIsModalVisible(false);
    } catch (error) {
      console.error("Error updating status:", error);
      const errorMessage =
        (error as any).response?.data?.error || "ไม่สามารถอัปเดตสถานะได้";
      message.error(errorMessage);
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const filteredRequestings = requestings.filter((req) => {
    const parcelName =
      req.Parcel?.ParcelName ||
      parcels.find((p) => p.PID === req.PID)?.ParcelName ||
      "";
    const staffFirst =
      req.Staff?.FirstName ||
      staffs.find((s) => s.StaffID === req.StaffID)?.FirstName ||
      "";
    const staffLast =
      req.Staff?.LastName ||
      staffs.find((s) => s.StaffID === req.StaffID)?.LastName ||
      "";

    const term = searchTerm.toLowerCase();
    return (
      parcelName.toLowerCase().includes(term) ||
      staffFirst.toLowerCase().includes(term) ||
      staffLast.toLowerCase().includes(term)
    );
  });

  const columns = [
    { title: "เลขที่คำร้อง", dataIndex: "Requesting_NO", key: "Requesting_NO" },
    {
      title: "สิ่งของที่ขอ",
      key: "parcel_name",
      render: (_: unknown, record: Requesting) => {
        const nameFromObj = record.Parcel?.ParcelName;
        const nameFromList = parcels.find(
          (p) => p.PID === record.PID
        )?.ParcelName;
        return nameFromObj || nameFromList || "-";
      },
    },
    { title: "จำนวน", dataIndex: "Amount_Request", key: "Amount_Request" },
    {
      title: "ผู้ร้องขอ",
      key: "staff_name",
      render: (_: any, record: Requesting) => {
        const nameFromObj = record.Staff
          ? `${record.Staff.FirstName || ""} ${
              record.Staff.LastName || ""
            }`.trim()
          : "";
        if (nameFromObj) return nameFromObj;

        const foundStaff = staffs.find((s) => s.StaffID === record.StaffID);
        return foundStaff
          ? `${foundStaff.FirstName || ""} ${foundStaff.LastName || ""}`.trim()
          : "-";
      },
    },
    {
      title: "วันที่ร้องขอ",
      dataIndex: "Request_Date",
      key: "Request_Date",
      render: (date: string) => (date ? dayjs(date).format("YYYY-MM-DD") : "-"),
    },
    {
      title: "สถานะคำขอ",
      key: "status",
      render: (_: any, record: Requesting) => {
        let color: "default" | "success" | "error" | "warning" = "default";
        if (record.Status_ID === 2) color = "success";
        if (record.Status_ID === 3) color = "error";
        if (record.Status_ID === 4) color = "warning";

        return (
          <Tag color={color}>
            {String(
              // ย้ายนิพจน์ทั้งหมดมาไว้ตรงนี้
              record.Status?.Status ||
                statuses.find((s) => s.Status_ID === record.Status_ID)
                  ?.Status ||
                "-"
            ).toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: "การกระทำ",
      key: "actions",
      render: (_: unknown, record: Requesting) => (
        <>
          <Button type="link" onClick={() => showModal(record)}>
            ดูรายละเอียด
          </Button>
          <Popconfirm
            title="คุณแน่ใจหรือไม่ที่จะลบคำร้องนี้?"
            onConfirm={() => handleDelete(record.Requesting_ID)}
            okText="ยืนยัน"
            cancelText="ยกเลิก"
          >
            <Button type="link" danger>
              ลบ
            </Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <div>
      <h2>จัดการคำร้องขอ</h2>
      <Input.Search
        placeholder="ค้นหาสิ่งของหรือชื่อผู้ร้องขอ"
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ marginBottom: 16 }}
        allowClear
      />
      <Button
        type="primary"
        onClick={() => showModal()}
        style={{ marginBottom: 16 }}
      >
        เพิ่มคำร้อง
      </Button>
      <Table
        dataSource={filteredRequestings}
        columns={columns as any}
        rowKey="Requesting_ID"
        loading={loading}
      />

      <Modal
        title={editingRequesting ? "รายละเอียดคำร้องขอ" : "เพิ่มคำร้อง"}
        open={isModalVisible}
        onCancel={handleCancel}
        destroyOnClose
        footer={
          editingRequesting
            ? [
                <Button key="back" onClick={handleCancel}>
                  ออก
                </Button>,
                ...(editingRequesting.Status_ID === 1
                  ? [
                      <Button
                        key="reject"
                        type="primary"
                        danger
                        loading={isSubmittingStatus}
                        onClick={() => handleStatusUpdate(3)}
                      >
                        ไม่อนุมัติ
                      </Button>,
                      <Button
                        key="approve"
                        type="primary"
                        loading={isSubmittingStatus}
                        onClick={() => handleStatusUpdate(2)}
                      >
                        อนุมัติ
                      </Button>,
                    ]
                  : []),
              ]
            : [
                <Button key="back" onClick={handleCancel}>
                  ยกเลิก
                </Button>,
                <Button key="submit" type="primary" onClick={handleOk}>
                  บันทึก
                </Button>,
              ]
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="สิ่งของที่ขอ"
            name="PID"
            rules={[{ required: true, message: "กรุณาเลือกสิ่งของ" }]}
          >
            <Select placeholder="เลือกสิ่งของ" disabled={!!editingRequesting}>
              {parcels.map((parcel) => (
                <Option key={parcel.PID} value={parcel.PID}>
                  {`${parcel.ParcelName} (คงเหลือ: ${parcel.Quantity})`}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="จำนวน"
            name="Amount_Request"
            rules={[
              { required: true, message: "กรุณากรอกจำนวน" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const num = Number(value);
                  if (!value || Number.isNaN(num)) {
                    return Promise.reject(
                      new Error("กรุณากรอกจำนวนให้ถูกต้อง")
                    );
                  }
                  if (num < 1)
                    return Promise.reject(
                      new Error("จำนวนต้องมีค่าอย่างน้อย 1")
                    );
                  const selectedParcelId = getFieldValue("PID");
                  const selectedParcel = parcels.find(
                    (p) => p.PID === selectedParcelId
                  );
                  if (selectedParcel && num > selectedParcel.Quantity) {
                    return Promise.reject(
                      new Error("จำนวนเกินกว่าที่มีในสต็อก")
                    );
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <Input type="number" disabled={!!editingRequesting} />
          </Form.Item>

          <Form.Item
            label="วันที่ร้องขอ"
            name="Request_Date"
            rules={[{ required: true, message: "กรุณาเลือกวันที่" }]}
          >
            <DatePicker
              style={{ width: "100%" }}
              disabled={!!editingRequesting}
            />
          </Form.Item>

          <Form.Item
            label="ผู้ร้องขอ"
            name="Staff_ID"
            rules={[{ required: true, message: "กรุณาเลือกผู้ร้องขอ" }]}
          >
            <Select placeholder="เลือกผู้ร้องขอ" disabled={!!editingRequesting}>
              {staffs.map((staff) => (
                <Option key={staff.StaffID} value={staff.StaffID}>
                  {`${staff.FirstName} ${staff.LastName}`}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RequestingManagement;
