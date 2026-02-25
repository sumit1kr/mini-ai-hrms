// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract WorkforceLogger {
    struct TaskEvent {
        string taskId;
        string employeeId;
        bytes32 activityHash;
        uint256 timestamp;
        address loggedBy;
    }

    struct PayrollEvent {
        string employeeId;
        bytes32 proofHash;
        uint256 amount;
        uint256 timestamp;
        address processedBy;
    }

    struct ActivitySummary {
        uint256 totalTasksCompleted;
        uint256 lastActivityTimestamp;
    }

    address public owner;

    TaskEvent[] private taskEvents;
    mapping(string => TaskEvent[]) private employeeTaskEvents;
    mapping(string => PayrollEvent[]) private employeePayrollEvents;

    mapping(string => ActivitySummary) public activitySummaries;

    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);

    event TaskCompleted(
        string indexed taskId,
        string indexed employeeId,
        bytes32 activityHash,
        uint256 timestamp,
        address loggedBy
    );

    event PayrollProcessed(
        string indexed employeeId,
        bytes32 proofHash,
        uint256 amount,
        uint256 timestamp,
        address processedBy
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnerTransferred(previousOwner, newOwner);
    }

    function logTaskCompletion(
        string calldata taskId,
        string calldata employeeId,
        bytes32 activityHash
    ) external onlyOwner {
        uint256 ts = block.timestamp;

        TaskEvent memory evt = TaskEvent({
            taskId: taskId,
            employeeId: employeeId,
            activityHash: activityHash,
            timestamp: ts,
            loggedBy: msg.sender
        });

        taskEvents.push(evt);
        employeeTaskEvents[employeeId].push(evt);

        ActivitySummary storage summary = activitySummaries[employeeId];
        summary.totalTasksCompleted += 1;
        summary.lastActivityTimestamp = ts;

        emit TaskCompleted(taskId, employeeId, activityHash, ts, msg.sender);
    }

    function logPayrollEvent(
        string calldata employeeId,
        uint256 amount,
        bytes32 proofHash
    ) external onlyOwner {
        uint256 ts = block.timestamp;

        PayrollEvent memory evt = PayrollEvent({
            employeeId: employeeId,
            proofHash: proofHash,
            amount: amount,
            timestamp: ts,
            processedBy: msg.sender
        });

        employeePayrollEvents[employeeId].push(evt);

        emit PayrollProcessed(employeeId, proofHash, amount, ts, msg.sender);
    }

    function getEmployeeTaskEvents(string calldata employeeId)
        external
        view
        returns (TaskEvent[] memory)
    {
        return employeeTaskEvents[employeeId];
    }

    function getEmployeePayrollEvents(string calldata employeeId)
        external
        view
        returns (PayrollEvent[] memory)
    {
        return employeePayrollEvents[employeeId];
    }

    function getTotalTaskEvents() external view returns (uint256) {
        return taskEvents.length;
    }

    function getTaskEventAt(uint256 index) external view returns (TaskEvent memory) {
        require(index < taskEvents.length, "Index out of bounds");
        return taskEvents[index];
    }
}
