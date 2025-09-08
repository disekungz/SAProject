// src/pages/MemberManagement.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Table,
  Typography,
  Input,
  Button,
  Space,
  Tag,
  Avatar,
  Popconfirm,
  message,
  Select,
} from "antd";
import {
  UserOutlined,
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  CrownOutlined,
  MailOutlined,
  IdcardOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { api } from "../lib/axios";

const { Title } = Typography;
const { Option } = Select;

type Rank = { RankID: number; RankName: string };
type Member = {
  MID: number;
  Username: string;
  Email: string;
  FirstName: string;
  LastName: string;
  Birthday: string;       // ISO string from backend
  RankID: number;
  Rank?: Rank;            // optional if backend returns Join
};

const rankColor = (r?: Rank | number) => {
  const id = typeof r === "number" ? r : r?.RankID;
  switch (id) {
    case 1: return "gold";     // แอดมิน
    case 2: return "blue";     // ผู้คุม
    case 3: return "green";    // ญาติ
    default: return "default";
  }
};

export default function MemberManagement() {
  const [members, setMembers] = useState<Member[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null); // MID ที่กำลังอัปเดต rank
  const [deleting, setDeleting] = useState<number | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [mRes, rRes] = await Promise.all([
        api.get("/members"), // backend ควร Preload("Rank")
        api.get("/ranks"),
      ]);
      setMembers(Array.isArray(mRes.data) ? mRes.data : []);
      setRanks(Array.isArray(rRes.data) ? rRes.data : []);
    } catch (e: any) {
      message.error(e?.response?.data?.error || "โหลดรายชื่อสมาชิกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return members;
    const s = q.trim().toLowerCase();
    return members.filter((m) =>
      (m.FirstName || "").toLowerCase().includes(s) ||
      (m.LastName || "").toLowerCase().includes(s) ||
      (m.Username || "").toLowerCase().includes(s) ||
      (m.Email || "").toLowerCase().includes(s) ||
      String(m.MID).includes(s)
    );
  }, [members, q]);

  const handleDelete = async (mid: number) => {
    setDeleting(mid);
    try {
      // NOTE: หลังบ้าน route เป็น /api/member/:id (เอกพจน์)
      await api.delete(`/member/${mid}`);
      message.success("ลบสมาชิกสำเร็จ");
      setMembers((prev) => prev.filter((m) => m.MID !== mid));
    } catch (e: any) {
      message.error(e?.response?.data?.error || "ลบสมาชิกไม่สำเร็จ");
    } finally {
      setDeleting(null);
    }
  };

  const updateRank = async (mid: number, newRankId: number) => {
    // อัปเดตแบบ optimistic
    const snapshot = members;
    setMembers((prev) =>
      prev.map((m) => (m.MID === mid ? { ...m, RankID: newRankId, Rank: ranks.find(r => r.RankID === newRankId) } : m))
    );
    setUpdating(mid);
    try {
      // 1) endpoint เฉพาะ rank (แนะนำให้ใช้)
      await api.put(`/members/${mid}/rank`, { rankId: newRankId });
      message.success("อัปเดตตำแหน่งสำเร็จ");
    } catch {
      try {
        // 2) สำรอง: PATCH ทั้ง member ด้วย rankId
        await api.patch(`/members/${mid}`, { rankId: newRankId });
        message.success("อัปเดตตำแหน่งสำเร็จ");
      } catch (e: any) {
        // revert ถ้าพัง
        setMembers(snapshot);
        message.error(e?.response?.data?.error || "อัปเดตตำแหน่งไม่สำเร็จ");
      }
    } finally {
      setUpdating(null);
    }
  };

  const columns = [
    {
      title: "#",
      key: "idx",
      width: 60,
      align: "center" as const,
      render: (_: any, __: Member, i: number) => <span style={{ color: "#666" }}>{i + 1}</span>,
    },
    {
      title: "MID",
      dataIndex: "MID",
      width: 90,
      align: "center" as const,
      render: (id: number) => (
        <Tag color="processing" style={{ margin: 0, fontWeight: 600 }}>{id}</Tag>
      ),
    },
    {
      title: "ข้อมูลสมาชิก",
      key: "profile",
      width: 260,
      render: (_: any, m: Member) => (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar icon={<UserOutlined />} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={`${m.FirstName} ${m.LastName}`}
            >
              {m.FirstName} {m.LastName}
            </div>
            <div style={{ color: "#666", fontSize: 12, display: "flex", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
              <span title={m.Username}><IdcardOutlined /> {m.Username}</span>
              <span title={m.Email}><MailOutlined /> {m.Email}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "วันเกิด",
      dataIndex: "Birthday",
      width: 130,
      align: "center" as const,
      render: (d: string) => (
        <span><CalendarOutlined style={{ color: "#666", marginRight: 6 }} />{dayjs(d).isValid() ? dayjs(d).format("DD/MM/YYYY") : "-"}</span>
      ),
    },
    {
      title: "ตำแหน่ง (Rank)",
      key: "rank",
      width: 260,
      render: (_: any, m: Member) => {
        // --- FIX: กันกรณี RankID เป็น 0/undefined หรือส่งมาเป็น string ---
        const raw = Number(m.Rank?.RankID ?? m.RankID);
        const current = ranks.some(r => r.RankID === raw) ? raw : 3; // fallback เป็น "ญาติ"

        return (
          <Space wrap>
            <Tag color={rankColor(current)} style={{ margin: 0 }}>
              <CrownOutlined /> {m.Rank?.RankName ?? ranks.find(r => r.RankID === current)?.RankName ?? "—"}
            </Tag>
            <Select
              size="middle"
              value={current}
              loading={updating === m.MID}
              onChange={(v) => updateRank(m.MID, Number(v))}
              style={{ minWidth: 160 }}
            >
              {ranks.map((r) => (
                <Option key={r.RankID} value={r.RankID}>
                  {r.RankName}
                </Option>
              ))}
            </Select>
          </Space>
        );
      },
    },
    {
      title: "จัดการ",
      key: "actions",
      width: 120,
      align: "center" as const,
      render: (_: any, m: Member) => (
        <Popconfirm
          title="ยืนยันการลบสมาชิก"
          description={`ต้องการลบ ${m.FirstName} ${m.LastName} หรือไม่?`}
          onConfirm={() => handleDelete(m.MID)}
          okText="ลบ"
          cancelText="ยกเลิก"
        >
          <Button
            icon={<DeleteOutlined />}
            danger
            loading={deleting === m.MID}
            size="small"
          >
            ลบ
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: 20 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0, color: "#1890ff" }}>
          <UserOutlined style={{ marginRight: 12 }} />
          จัดการสมาชิก
        </Title>
        <p style={{ color: "#666", margin: "8px 0 0 0" }}>
          ปรับตำแหน่ง (Rank) ของผู้ใช้ได้จากตารางด้านล่าง หรือลบสมาชิกที่ไม่ใช้งาน
        </p>
      </div>

      <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: "12px 16px" }}>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Input
            placeholder="ค้นหา: MID, ชื่อ-นามสกุล, Username, Email"
            allowClear
            prefix={<SearchOutlined style={{ color: "#1890ff" }} />}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 480, borderRadius: 8 }}
            onPressEnter={load}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>
            รีเฟรช
          </Button>
        </Space>
      </Card>

      <Card bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="MID"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ["5", "10", "20", "50"],
            showTotal: (t, r) => `แสดง ${r[0]}-${r[1]} จาก ${t} รายการ`,
          }}
          size="small"
          scroll={{ x: 980 }}
        />
      </Card>
    </div>
  );
}
