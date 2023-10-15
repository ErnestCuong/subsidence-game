import { FaTree } from "react-icons/fa";

const Tree = ({ onClick }) => {
  return (
    <button className="bg-green-300 w-full h-full flex justify-center items-center" onClick={onClick}>
      <FaTree/>
    </button>
  )
}

export default Tree