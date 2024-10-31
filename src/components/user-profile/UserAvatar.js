import React, { useEffect } from "react";
import useErrorSimulator from "@/hooks/useErrorSimulator";

const UserAvatar = () => {
  useErrorSimulator({ message: "UserAvatar error" });
  return <img src="https://picsum.photos/100/100" alt="User Avatar" />;
};

export default UserAvatar;
