import { FaRoad } from "react-icons/fa";

const Road = ({ onClick }) => {
  return (
    <button className="bg-gray-300 w-full h-full flex justify-center items-center" onClick={onClick}>
      <FaRoad/>
    </button>
  )
}

export default Road